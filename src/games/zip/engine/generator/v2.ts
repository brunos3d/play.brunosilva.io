/**
 * Generator version 2: themed boards.
 *
 * Version 1 shuffled the path into noise and scattered walls wherever they
 * removed a wrong solution, so every board looked alike and the solved picture
 * was a scribble. Version 2 picks a theme from the seed:
 *
 * - a wall figure (cross, frame, corners, corridors, slash, face, pinwheel,
 *   mirrored walls) with the path grown around it, or
 * - a drawn path (spiral, snake, Hilbert curve) that is only lightly disturbed,
 *   so the finished board still shows the drawing.
 *
 * Walls added for uniqueness come with their mirror twin when the theme is
 * symmetric. The harder tiers then hide some numbers behind a "?". Several
 * boards are built per puzzle and the tier keeps the one whose trap score is
 * closest to its target (see difficulty.ts).
 */
import { type Rng, createRng } from "@/shared/engine/prng";
import { MIN_CHECKPOINTS, ZIP_TIERS, type ZipTier } from "../config";
import { buildTopology, cellAt, makeWall, wallKey } from "../grid";
import { type PuzzleSpec, zipSeeds } from "../seed";
import { solveZip } from "../solver";
import type { Checkpoint, Wall, ZipShape } from "../types";
import { type TrapReport, measureTraps } from "./difficulty";
import { FIGURES, type Figure, buildFigure, twinWall } from "./figures";
import type { GeneratedBoard } from "./index";
import { PATH_STYLES, type PathStyle, backbite, basePath, findHamiltonianPath } from "./paths";

const MAX_ATTEMPTS = 40;
const UNIQUENESS_NODE_BUDGET = 40_000;
const MAX_PRUNE_CHECKS = 24;
/** A path grown around a figure is mixed this much, in backbite moves per cell. Enough to hide the search order, not the figure. */
const FIGURE_MIX = 6;
const RANDOM_MIX = 40;

const openNeighbors = (size: number): number[][] => buildTopology({ width: size, height: size, checkpoints: [], walls: [] }).neighbors;

/** A path for the theme: grown around the figure, or a disturbed drawing on the open board. */
function themedPath(rng: Rng, size: number, tier: ZipTier, figure: Figure): { path: number[]; style: PathStyle } | null {
  const cells = size * size;
  if (figure.walls.length > 0) {
    const { neighbors } = buildTopology({ width: size, height: size, checkpoints: [], walls: figure.walls });
    const found = findHamiltonianPath(rng, neighbors, size);
    return found ? { path: backbite(rng, found, neighbors, cells * FIGURE_MIX), style: "hugging" } : null;
  }
  const neighbors = openNeighbors(size);
  const styles = PATH_STYLES.filter((style): style is Exclude<PathStyle, "hugging"> => style !== "hugging");
  const style = rng.weighted(styles, styles.map((name) => tier.pathOdds[name]));
  if (style === "random") return { path: backbite(rng, basePath(rng, "snake", size, neighbors)!, neighbors, cells * RANDOM_MIX), style };
  const drawn = basePath(rng, style, size, neighbors);
  if (!drawn) return null;
  const [min, max] = tier.perturbation;
  return { path: backbite(rng, drawn, neighbors, Math.round(cells * (min + rng.next() * (max - min)))), style };
}

/** Numbers 1..n along the path. The stretches between them vary in length by `gapVariance`, so a board is not n equal chores. */
function placeCheckpoints(rng: Rng, path: readonly number[], tier: ZipTier): number[] {
  const [minDensity, maxDensity] = tier.checkpointDensity;
  const count = Math.max(MIN_CHECKPOINTS, Math.round(path.length * (minDensity + rng.next() * (maxDensity - minDensity))));
  const weights = Array.from({ length: count - 1 }, () => 1 + (rng.next() * 2 - 1) * tier.gapVariance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  const picks = new Set<number>([0, path.length - 1]);
  let travelled = 0;
  for (const weight of weights.slice(0, -1)) {
    travelled += weight;
    picks.add(Math.max(1, Math.min(path.length - 2, Math.round((travelled / total) * (path.length - 1)))));
  }
  return [...picks].sort((a, b) => a - b);
}

const toCheckpoints = (picks: readonly number[], path: readonly number[], size: number): Checkpoint[] =>
  picks.map((pathIndex, order) => ({ number: order + 1, ...cellAt(size, path[pathIndex]) }));

/**
 * Makes the intended path the only solution, one impostor at a time.
 *
 * A tier can ask for numbers first. A new number goes on a cell that the
 * impostor visits in a different stretch than the real path does (before an
 * earlier number, or after a later one), which rules the impostor out. A number
 * tells the player nothing about the next turn. It is a constraint on order
 * that only bites many cells later, so it keeps a board hard where a wall would
 * give a turn away. When no such cell exists, or the tier's number budget is
 * spent, a wall on an edge only the impostor uses does the job, together with
 * its mirror twin when the theme is symmetric.
 *
 * A final pass drops added walls, twins together, that turn out not to be
 * needed. Figure walls are never touched.
 */
function makeUnique(
  rng: Rng,
  size: number,
  solution: readonly number[],
  startPicks: readonly number[],
  figure: Figure,
  tier: ZipTier,
): { walls: Wall[]; picks: number[]; nodes: number } | null {
  const cells = size * size;
  const maxExtraWalls = Math.floor(cells * tier.maxExtraWallShare);
  const maxNumbers = Math.max(startPicks.length, Math.round(cells * tier.maxCheckpointDensity));
  const solutionEdges = new Set<string>();
  for (let i = 1; i < solution.length; i++) solutionEdges.add(wallKey(solution[i - 1], solution[i]));
  const isSolution = (path: readonly number[]): boolean => path.every((cell, index) => cell === solution[index]);

  const present = new Set(figure.walls.map((wall) => wallKey(wall.a, wall.b)));
  const groups: Wall[][] = [];
  let picks = [...startPicks];
  const shape = (walls: Wall[]): ZipShape => ({ width: size, height: size, checkpoints: toCheckpoints(picks, solution, size), walls });
  const allWalls = (): Wall[] => [...figure.walls, ...groups.flat()];
  let nodes = 0;

  for (;;) {
    const result = solveZip(shape(allWalls()), { maxSolutions: 2, maxNodes: UNIQUENESS_NODE_BUDGET });
    nodes += result.nodes;
    if (result.unique) break;
    const impostor = result.solutions.find((path) => !isSolution(path));
    if (!impostor) return null;

    if (tier.uniqueness === "numbers-first" && picks.length < maxNumbers) {
      // Stretch of a cell = how many numbered cells come before it. A cell whose stretch differs between the two paths separates them.
      const impostorIndex = new Int32Array(cells);
      impostor.forEach((cell, index) => (impostorIndex[cell] = index));
      const numberedAt = picks.map((pathIndex) => impostorIndex[solution[pathIndex]]).sort((a, b) => a - b);
      const separating: number[] = [];
      let stretch = 0;
      for (let index = 0; index < solution.length; index++) {
        if (picks.includes(index)) {
          stretch++;
          continue;
        }
        const position = impostorIndex[solution[index]];
        let impostorStretch = 0;
        while (impostorStretch < numberedAt.length && numberedAt[impostorStretch] < position) impostorStretch++;
        if (impostorStretch !== stretch) separating.push(index);
      }
      if (separating.length > 0) {
        picks = [...picks, rng.pick(separating)].sort((a, b) => a - b);
        continue;
      }
    }

    if (groups.flat().length >= maxExtraWalls) return null;
    const wrongEdges: Wall[] = [];
    for (let i = 1; i < impostor.length; i++) {
      const key = wallKey(impostor[i - 1], impostor[i]);
      if (!solutionEdges.has(key) && !present.has(key)) wrongEdges.push(makeWall(impostor[i - 1], impostor[i]));
    }
    if (wrongEdges.length === 0) return null;
    const wall = rng.pick(wrongEdges);
    const group = [wall];
    present.add(wallKey(wall.a, wall.b));
    const twin = twinWall(figure.symmetry, size, wall);
    if (twin && !solutionEdges.has(wallKey(twin.a, twin.b)) && !present.has(wallKey(twin.a, twin.b))) {
      group.push(twin);
      present.add(wallKey(twin.a, twin.b));
    }
    groups.push(group);
  }

  let checks = 0;
  for (const group of rng.shuffle(groups)) {
    if (checks++ >= MAX_PRUNE_CHECKS) break;
    const without = groups.filter((other) => other !== group);
    const result = solveZip(shape([...figure.walls, ...without.flat()]), { maxSolutions: 2, maxNodes: UNIQUENESS_NODE_BUDGET });
    nodes += result.nodes;
    if (result.unique) groups.splice(groups.indexOf(group), 1);
  }
  return { walls: allWalls(), picks, nodes };
}

/**
 * Hides numbers behind a "?". The player still sees that the cell is numbered,
 * but not its place in the order, so a "?" fits anywhere in the sequence (see
 * rules.ts). Each one is only hidden if the board keeps a single solution under
 * that looser rule. 1 and the last number always stay visible, and so does at
 * least one number in between.
 */
function hideNumbers(rng: Rng, shape: ZipShape, tier: ZipTier): { checkpoints: Checkpoint[]; nodes: number } {
  const [min, max] = tier.hiddenNumbers;
  const between = shape.checkpoints.slice(1, -1);
  const quota = Math.min(between.length - 1, Math.round(between.length * (min + rng.next() * (max - min))));
  let checkpoints = [...shape.checkpoints];
  let nodes = 0;
  let hidden = 0;
  for (const candidate of rng.shuffle(between)) {
    if (hidden >= quota) break;
    const trial = checkpoints.map((checkpoint) => (checkpoint.number === candidate.number ? { ...checkpoint, hidden: true } : checkpoint));
    const result = solveZip({ ...shape, checkpoints: trial }, { maxSolutions: 2, maxNodes: UNIQUENESS_NODE_BUDGET });
    nodes += result.nodes;
    if (!result.unique) continue;
    checkpoints = trial;
    hidden++;
  }
  return { checkpoints, nodes };
}

type Candidate = GeneratedBoard & { traps: TrapReport; rng: Rng };

function buildCandidate(key: string, attempt: number, size: number, tier: ZipTier): Candidate | null {
  const rng = createRng(`${key}|attempt|${attempt}`);
  // A symmetric theme without a figure still mirrors its extra walls, which is what makes a drawn-path board look composed.
  const figureName = rng.weighted(FIGURES, FIGURES.map((name) => tier.figureOdds[name] ?? 0));
  const built = buildFigure(figureName, size, rng);
  const figure: Figure = built.walls.length > 0 ? built : { name: "none", symmetry: rng.pick(["mirror-x", "mirror-y", "rotate"] as const), walls: [] };

  const themed = themedPath(rng, size, tier, figure);
  if (!themed) return null;
  const unique = makeUnique(rng, size, themed.path, placeCheckpoints(rng, themed.path, tier), figure, tier);
  if (!unique) return null;

  const checkpoints = toCheckpoints(unique.picks, themed.path, size);
  const walls = [...unique.walls].sort((a, b) => a.a - b.a || a.b - b.b);
  const shape: ZipShape = { width: size, height: size, checkpoints, walls };
  return {
    size,
    checkpoints,
    walls,
    solution: themed.path,
    attempts: attempt,
    solverNodes: unique.nodes,
    theme: { figure: figure.name, path: themed.style },
    traps: measureTraps(shape, buildTopology(shape), themed.path),
    rng,
  };
}

export function generateZipV2(spec: PuzzleSpec): GeneratedBoard {
  const tier = ZIP_TIERS[spec.difficulty];
  const key = zipSeeds.rngKey(spec);
  const size = spec.size ?? createRng(`${key}|size`).pick(tier.sizes);

  const candidates: Candidate[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && candidates.length < tier.candidates; attempt++) {
    const candidate = buildCandidate(key, attempt, size, tier);
    if (candidate) candidates.push(candidate);
  }
  if (candidates.length === 0) throw new Error(`No uniquely solvable board found for seed ${zipSeeds.format(spec)}`);

  // Closest to the tier's target. An infinite target means the highest score wins.
  const distance = (candidate: Candidate): number => (Number.isFinite(tier.targetTraps) ? Math.abs(candidate.traps.score - tier.targetTraps) : -candidate.traps.score);
  const ranked = [...candidates].sort((a, b) => distance(a) - distance(b));
  // Numbers are hidden on the chosen board only. Every trial is a full uniqueness proof, too slow to run on boards that get thrown away.
  const { traps: openTraps, rng, ...board } = ranked[0];
  const shape: ZipShape = { width: size, height: size, checkpoints: board.checkpoints, walls: board.walls };
  const hiding = hideNumbers(rng, shape, tier);
  if (hiding.checkpoints.every((checkpoint) => !checkpoint.hidden)) return { ...board, traps: openTraps };
  const hiddenShape = { ...shape, checkpoints: hiding.checkpoints };
  return { ...board, checkpoints: hiding.checkpoints, solverNodes: board.solverNodes + hiding.nodes, traps: measureTraps(hiddenShape, buildTopology(hiddenShape), board.solution) };
}
