import { type Rng, createRng } from "@/shared/engine/prng";
import { QUEENS_TIERS, type QueensTier } from "../config";
import { buildTopology, sideNeighbors } from "../grid";
import { type PuzzleSpec, queensSeeds } from "../seed";
import { type Deduction, deduce } from "../solver/logic";

/** What a generator version hands back. Ids, the seed string and metadata are added in index.ts, the same way for every version. */
export type GeneratedBoard = {
  size: number;
  regions: number[];
  solution: number[];
  attempts: number;
  /** Nodes visited while proving, cell by cell, that no second solution appears. */
  solverNodes: number;
  deduction: Deduction;
};

/** Attempts per puzzle. Each has its own PRNG stream, so one attempt never shifts the next. */
const MAX_ATTEMPTS = 300;
/** A tier stops building once it has this many times its candidate count, even if few of the boards fit its level range. */
const BUILD_FACTOR = 3;

/**
 * One queen per row and column, no two touching. Backtracking over shuffled
 * columns, so the layout is random but always found.
 */
function placeQueens(rng: Rng, size: number): number[] | null {
  const columns: number[] = [];
  const used = new Array<boolean>(size).fill(false);
  const orders = Array.from({ length: size }, () => rng.shuffle(Array.from({ length: size }, (_, column) => column)));
  const place = (row: number): boolean => {
    if (row === size) return true;
    for (const column of orders[row]) {
      if (used[column] || (row > 0 && Math.abs(columns[row - 1] - column) <= 1)) continue;
      used[column] = true;
      columns[row] = column;
      if (place(row + 1)) return true;
      used[column] = false;
    }
    return false;
  };
  return place(0) ? columns.slice(0, size).map((column, row) => row * size + column) : null;
}

/** True when the region stays in one piece without `removed`. */
function staysConnected(size: number, regions: readonly number[], region: number, removed: number): boolean {
  const members: number[] = [];
  for (let cell = 0; cell < regions.length; cell++) if (regions[cell] === region && cell !== removed) members.push(cell);
  if (members.length === 0) return false;
  const inRegion = new Set(members);
  const seen = new Set([members[0]]);
  const queue = [members[0]];
  while (queue.length > 0) {
    for (const next of sideNeighbors(size, queue.pop()!)) {
      if (inRegion.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === members.length;
}

/**
 * A solution of the cells assigned so far that has a queen on `forced`, or
 * null when there is none. Cells with region -1 belong to no region yet and
 * cannot hold a queen. Row by row, like solver/search.ts, with the forced row fixed.
 */
function solutionThrough(size: number, regions: readonly number[], forced: number, counter: { nodes: number }): number[] | null {
  const forcedRow = Math.floor(forced / size);
  const forcedColumn = forced % size;
  const columns = new Int32Array(size);
  columns[forcedRow] = forcedColumn;
  const place = (row: number, usedColumns: number, usedRegions: number): boolean => {
    if (row === size) return true;
    const previous = row > 0 ? columns[row - 1] : -9;
    if (row === forcedRow) return (forcedColumn - previous > 1 || previous - forcedColumn > 1) && place(row + 1, usedColumns, usedRegions);
    for (let column = 0; column < size; column++) {
      if (usedColumns & (1 << column)) continue;
      if (column - previous <= 1 && previous - column <= 1) continue;
      // The row above the forced queen must keep its distance from it as well.
      if (row === forcedRow - 1 && column - forcedColumn <= 1 && forcedColumn - column <= 1) continue;
      const region = regions[row * size + column];
      if (region < 0 || usedRegions & (1 << region)) continue;
      counter.nodes++;
      columns[row] = column;
      if (place(row + 1, usedColumns | (1 << column), usedRegions | (1 << region))) return true;
    }
    return false;
  };
  // The forced queen takes its column and its region before the search starts, which prunes the rows above it.
  return place(0, 1 << forcedColumn, 1 << regions[forced]) ? Array.from(columns, (column, row) => row * size + column) : null;
}

const STARVING_BOOST = 40;
/** Reshaping moves one board may try in total. A board that needs more is cheaper to drop than to rescue. */
const MAX_TRIALS = 200;
/** Times one board may reshape a region to get past a cell that every neighbour refuses. */
const MAX_UNBLOCKS = 60;

/**
 * Grows one region around each queen until the board is covered, and keeps the
 * solution unique the whole way.
 *
 * At the start every region is its queen's cell, so the only solution is the
 * intended one. Each round picks a region in proportion to its appetite and
 * offers it a free cell next to it. The cell is only accepted if no solution
 * can put a queen on it. More cells never remove a solution, so a refused pair
 * of cell and region stays refused, and a board that gets covered has exactly
 * one solution. Regions are connected by construction.
 *
 * Near the end some cell is usually refused by every region around it. Each
 * refusal has a witness: a second solution that would appear. The generator
 * then moves another cell of that witness into a neighbouring region, which
 * kills the witness, and only if that move itself opens no new solution. The
 * refused cell gets another try afterwards. Returns null when no such move
 * exists or the budget runs out.
 */
function growRegions(rng: Rng, size: number, queens: readonly number[], tier: QueensTier): { regions: number[]; nodes: number } | null {
  const cellCount = size * size;
  const intended = new Set(queens);
  const regions = new Array<number>(cellCount).fill(-1);
  const appetite = queens.map(() => tier.appetite[0] + rng.next() * (tier.appetite[1] - tier.appetite[0]));
  queens.forEach((cell, region) => {
    regions[cell] = region;
  });
  const refused = new Uint8Array(cellCount * size);
  const sizes = new Array<number>(size).fill(1);
  const counter = { nodes: 0 };
  const neighbors = Array.from({ length: cellCount }, (_, cell) => sideNeighbors(size, cell));
  /** Regions next to a cell, lowest id first, without `except`. */
  const regionsAround = (cell: number, except: number): number[] => {
    const around: number[] = [];
    for (const next of neighbors[cell]) {
      const region = regions[next];
      if (region >= 0 && region !== except && !around.includes(region)) around.push(region);
    }
    return around.sort((a, b) => a - b);
  };

  let trials = 0;
  const unblock = (): boolean => {
    const waiting: number[] = [];
    for (let cell = 0; cell < cellCount; cell++) if (regions[cell] === -1 && regionsAround(cell, -1).length > 0) waiting.push(cell);
    for (const cell of rng.shuffle(waiting)) {
      for (const region of rng.shuffle(regionsAround(cell, -1))) {
        regions[cell] = region;
        const witness = solutionThrough(size, regions, cell, counter);
        regions[cell] = -1;
        if (!witness) {
          refused[cell * size + region] = 0;
          return true;
        }
        for (const other of rng.shuffle(witness.filter((candidate) => candidate !== cell && !intended.has(candidate)))) {
          const from = regions[other];
          if (!staysConnected(size, regions, from, other)) continue;
          for (const target of rng.shuffle(regionsAround(other, from))) {
            if (++trials > MAX_TRIALS) return false;
            regions[other] = target;
            if (!solutionThrough(size, regions, other, counter)) {
              refused[cell * size + region] = 0;
              sizes[from]--;
              sizes[target]++;
              return true;
            }
            regions[other] = from;
          }
        }
      }
    }
    return false;
  };

  let unblocks = 0;
  for (let left = cellCount - size; left > 0; ) {
    const open: number[][] = queens.map(() => []);
    for (let cell = 0; cell < cellCount; cell++) {
      if (regions[cell] !== -1) continue;
      for (const next of neighbors[cell]) {
        const region = regions[next];
        if (region >= 0 && !refused[cell * size + region] && open[region][open[region].length - 1] !== cell) open[region].push(cell);
      }
    }
    const growing = open.map((cells, region) => (cells.length > 0 ? region : -1)).filter((region) => region >= 0);
    if (growing.length === 0) {
      if (++unblocks > MAX_UNBLOCKS || !unblock()) return null;
      continue;
    }
    // A region below the tier's floor eats first, so it is not walled in while still too small.
    const region = rng.weighted(growing, growing.map((candidate) => (sizes[candidate] < tier.minRegionSize ? STARVING_BOOST : 1) * appetite[candidate]));
    const cell = rng.pick(open[region]);
    regions[cell] = region;
    if (solutionThrough(size, regions, cell, counter)) {
      regions[cell] = -1;
      refused[cell * size + region] = 1;
    } else {
      sizes[region]++;
      left--;
    }
  }
  return { regions, nodes: counter.nodes };
}

function buildCandidate(rng: Rng, size: number, tier: QueensTier): Omit<GeneratedBoard, "attempts"> | null {
  const solution = placeQueens(rng, size);
  if (!solution) return null;
  const grown = growRegions(rng, size, solution, tier);
  if (!grown) return null;
  const { regions } = grown;

  const sizes = new Array<number>(size).fill(0);
  for (const region of regions) sizes[region]++;
  // Small boards cannot always avoid tiny regions, so the floor only applies from 7x7 up.
  if (size >= 7 && sizes.some((count) => count < tier.minRegionSize)) return null;

  // One solution is not enough: the board must also fall to deduction, or a player would have to guess.
  const deduction = deduce(buildTopology({ size, regions }));
  if (!deduction.solved) return null;
  return { size, regions, solution, solverNodes: grown.nodes, deduction };
}

/** How far a board is from what the tier wants. Lower is better. */
function tierCost(tier: QueensTier, size: number, deduction: Deduction): number {
  const target = tier.targetScorePerRow * size;
  const distance = Number.isFinite(target) ? Math.abs(deduction.score - target) : -deduction.score;
  const tooHard = Math.max(0, deduction.maxLevel - tier.maxLevel) * 10_000;
  const tooEasy = Math.max(0, tier.minLevel - deduction.maxLevel) * 1_000;
  return distance + tooHard + tooEasy;
}

/**
 * Generator version 1. Builds boards until `tier.candidates` of them need no
 * technique above the tier's level, then keeps the one whose deduction profile
 * is closest to the tier. Every board it considers has one solution (search
 * solver) and falls to deduction alone (logic solver).
 */
export function generateQueensV1(spec: PuzzleSpec): GeneratedBoard {
  const tier = QUEENS_TIERS[spec.difficulty];
  const key = queensSeeds.rngKey(spec);
  const size = spec.size ?? createRng(`${key}|size`).pick(tier.sizes);

  let best: (Omit<GeneratedBoard, "attempts"> & { cost: number }) | null = null;
  let built = 0;
  let fitting = 0;
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS && fitting < tier.candidates && built < tier.candidates * BUILD_FACTOR) {
    attempt++;
    const candidate = buildCandidate(createRng(`${key}|attempt-${attempt}`), size, tier);
    if (!candidate) continue;
    built++;
    if (candidate.deduction.maxLevel <= tier.maxLevel) fitting++;
    const cost = tierCost(tier, size, candidate.deduction);
    if (!best || cost < best.cost) best = { ...candidate, cost };
  }
  if (!best) throw new Error(`No Queens board found for ${queensSeeds.format(spec)} in ${MAX_ATTEMPTS} attempts.`);
  return { size: best.size, regions: best.regions, solution: best.solution, solverNodes: best.solverNodes, deduction: best.deduction, attempts: attempt };
}
