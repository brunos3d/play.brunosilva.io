import { createRng, type Rng } from "@/shared/engine/prng";
import { SUMBREAK_TIERS, type SumbreakTier } from "../config";
import { neighboursOf } from "../rules";
import { type PuzzleSpec, sumbreakSeeds } from "../seed";
import { SolverBudgetExceeded, SumbreakSolver } from "../solver";
import type { Merge } from "../types";

export type GeneratedBoard = { size: number; cells: number[]; total: number; solution: Merge[]; attempts: number; solverNodes: number; winChance: number };

/** Positions one candidate board may cost the solver. Past it the board is dropped, on every machine alike. */
const NODE_BUDGET = 60_000;

/**
 * Builds a board backwards. It starts from the single tile a solved board ends
 * with and keeps breaking a tile in two: the tile keeps half, and the other
 * half lands on an empty cell beside it. Played in reverse, every break is a
 * merge, so the board is solvable by construction and the list of breaks,
 * reversed, is a solution.
 *
 * `spread` leans the choice of which tile to break. Near 0 it favours large
 * tiles, which gives many small equal numbers and many ways to go wrong. Near 1
 * it favours small tiles and leaves a chain of large ones that almost merges by
 * itself. Returns null when the board cannot be filled, which happens when
 * every tile next to an empty cell is already a 1.
 */
export function buildBackwards(rng: Rng, size: number, exponent: number, spread: number): { cells: number[]; solution: Merge[] } | null {
  const neighbours = neighboursOf(size);
  const cells = new Array<number>(size * size).fill(0);
  cells[rng.int(size * size)] = 2 ** exponent;
  const breaks: Merge[] = [];

  for (let tiles = 1; tiles < size * size; tiles++) {
    const options: Merge[] = [];
    const weights: number[] = [];
    for (let cell = 0; cell < cells.length; cell++) {
      if (cells[cell] < 2) continue;
      for (const empty of neighbours[cell]) {
        if (cells[empty] !== 0) continue;
        // The merge that undoes this break drops the new tile back onto the one that was broken.
        options.push({ from: empty, to: cell });
        const rank = Math.log2(cells[cell]) / exponent;
        weights.push(0.05 + (1 - spread) * rank + spread * (1 - rank));
      }
    }
    if (options.length === 0) return null;
    const choice = rng.weighted(options, weights);
    cells[choice.to] /= 2;
    cells[choice.from] = cells[choice.to];
    breaks.push(choice);
  }
  return { cells, solution: breaks.reverse() };
}

/**
 * Version 1. Builds several boards for the seed and keeps the one whose win
 * chance is closest to what the tier asks for, on a log scale, because the
 * interesting differences are between 1 in 5 and 1 in 50.
 */
export function generateSumbreakV1(spec: PuzzleSpec): GeneratedBoard {
  const tier: SumbreakTier = SUMBREAK_TIERS[spec.difficulty];
  const key = sumbreakSeeds.rngKey(spec);
  const setup = createRng(key);
  const size = spec.size ?? setup.pick(tier.sizes);
  const [low, high] = tier.exponent[size];
  const target = Math.log(tier.winChance);

  let best: GeneratedBoard | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let solverNodes = 0;
  let attempts = 0;
  for (let attempt = 0; attempt < tier.candidates * 4 && attempts < tier.candidates; attempt++) {
    const rng = createRng(`${key}|${attempt}`);
    const built = buildBackwards(rng, size, rng.range(low, high), tier.spread[0] + rng.next() * (tier.spread[1] - tier.spread[0]));
    if (!built) continue;
    const solver = new SumbreakSolver(size, NODE_BUDGET);
    let winChance: number;
    try {
      winChance = solver.winChance(built.cells);
    } catch (error) {
      if (!(error instanceof SolverBudgetExceeded)) throw error;
      solverNodes += solver.nodes;
      continue;
    }
    solverNodes += solver.nodes;
    attempts++;
    const distance = Math.abs(Math.log(Math.max(winChance, 1e-6)) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { size, cells: built.cells, total: built.cells.reduce((sum, value) => sum + value, 0), solution: built.solution, attempts, solverNodes, winChance };
    }
    if (distance <= tier.tolerance) break;
  }
  if (!best) throw new Error("No board could be built from this seed.");
  return { ...best, attempts, solverNodes };
}
