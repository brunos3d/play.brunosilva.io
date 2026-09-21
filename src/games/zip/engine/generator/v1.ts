/**
 * Generator version 1, frozen. Seeds with version 1 must keep producing the
 * boards they always did, so nothing in this file may change, its tier table
 * included. New work goes into v2.ts.
 */
import type { Difficulty } from "@/shared/engine/difficulty";
import { type Rng, createRng } from "@/shared/engine/prng";
import { cellAt, gridNeighbors, makeWall, wallKey } from "../grid";
import { type PuzzleSpec, zipSeeds } from "../seed";
import { solveZip } from "../solver";
import type { Checkpoint, Wall, ZipShape } from "../types";
import type { GeneratedBoard } from "./index";

type ZipTier = { sizes: readonly number[]; checkpointDensity: readonly [number, number]; maxWallShare: number };
const MIN_CHECKPOINTS = 3;
const ZIP_TIERS: Record<Difficulty, ZipTier> = {
  easy: { sizes: [5, 6], checkpointDensity: [0.16, 0.22], maxWallShare: 0.3 },
  medium: { sizes: [6, 7], checkpointDensity: [0.12, 0.16], maxWallShare: 0.3 },
  hard: { sizes: [7, 8], checkpointDensity: [0.09, 0.12], maxWallShare: 0.32 },
  expert: { sizes: [8], checkpointDensity: [0.07, 0.095], maxWallShare: 0.34 },
};

const MAX_ATTEMPTS = 60;
/** Backbite moves per cell. Enough to erase the starting snake on every supported size. */
const SHUFFLE_MOVES_PER_CELL = 40;
const UNIQUENESS_NODE_BUDGET = 40_000;
const MAX_PRUNE_CHECKS = 24;

/**
 * Random Hamiltonian path by "backbiting". Start from a plain snake. Pick an
 * end of the path and a grid neighbour of it that is not its path neighbour,
 * then reverse the stretch between them. The result is again a Hamiltonian
 * path, and repeating the move mixes it thoroughly. It cannot fail, unlike a
 * Warnsdorff walk, and it has none of that walk's spiral bias.
 */
function randomHamiltonianPath(rng: Rng, width: number, height: number): number[] {
  const path: number[] = [];
  for (let row = 0; row < height; row++) {
    for (let step = 0; step < width; step++) path.push(row * width + (row % 2 === 0 ? step : width - 1 - step));
  }
  const position = new Int32Array(path.length);
  path.forEach((cell, index) => (position[cell] = index));

  const reverse = (from: number, to: number): void => {
    for (let i = from, j = to; i < j; i++, j--) {
      [path[i], path[j]] = [path[j], path[i]];
      position[path[i]] = i;
      position[path[j]] = j;
    }
  };

  const moves = path.length * SHUFFLE_MOVES_PER_CELL;
  for (let move = 0; move < moves; move++) {
    const atTail = rng.chance(0.5);
    const endCell = atTail ? path[path.length - 1] : path[0];
    const pathNeighbor = atTail ? path[path.length - 2] : path[1];
    const options = gridNeighbors(width, height, endCell).filter((cell) => cell !== pathNeighbor);
    if (options.length === 0) continue;
    const index = position[rng.pick(options)];
    if (atTail) reverse(index + 1, path.length - 1);
    else reverse(0, index - 1);
  }
  return path;
}

/** Numbers 1..n along the path: 1 on the first cell, n on the last, the rest spread out with some jitter. */
function placeCheckpoints(rng: Rng, path: readonly number[], width: number, tier: ZipTier): Checkpoint[] {
  const [minDensity, maxDensity] = tier.checkpointDensity;
  const density = minDensity + rng.next() * (maxDensity - minDensity);
  const count = Math.max(MIN_CHECKPOINTS, Math.round(path.length * density));

  const picks = new Set<number>([0, path.length - 1]);
  const spacing = (path.length - 1) / (count - 1);
  for (let i = 1; i < count - 1; i++) {
    const jitter = Math.round((rng.next() - 0.5) * spacing * 0.5);
    picks.add(Math.max(1, Math.min(path.length - 2, Math.round(i * spacing) + jitter)));
  }
  return [...picks]
    .sort((a, b) => a - b)
    .map((pathIndex, order) => ({ number: order + 1, ...cellAt(width, path[pathIndex]) }));
}

/**
 * Adds walls until the intended path is the only solution. Each round asks the
 * solver for a second solution and walls off one edge that the impostor uses
 * and the real path does not, so every wall removes at least one wrong answer.
 * A final pass drops walls that turned out not to be needed.
 */
function wallsForUniqueness(rng: Rng, shape: ZipShape, solution: readonly number[], maxWalls: number): { walls: Wall[]; nodes: number } | null {
  const solutionEdges = new Set<string>();
  for (let i = 1; i < solution.length; i++) solutionEdges.add(wallKey(solution[i - 1], solution[i]));
  const isSolution = (path: readonly number[]): boolean => path.every((cell, index) => cell === solution[index]);

  const walls: Wall[] = [];
  let nodes = 0;
  for (;;) {
    const result = solveZip({ ...shape, walls }, { maxSolutions: 2, maxNodes: UNIQUENESS_NODE_BUDGET });
    nodes += result.nodes;
    if (result.unique) break;
    const impostor = result.solutions.find((path) => !isSolution(path));
    // No impostor found within the budget means uniqueness is unproven. Give up on this layout.
    if (!impostor || walls.length >= maxWalls) return null;
    const wrongEdges: Wall[] = [];
    for (let i = 1; i < impostor.length; i++) {
      if (!solutionEdges.has(wallKey(impostor[i - 1], impostor[i]))) wrongEdges.push(makeWall(impostor[i - 1], impostor[i]));
    }
    walls.push(rng.pick(wrongEdges));
  }

  let checks = 0;
  for (const wall of rng.shuffle(walls)) {
    if (checks++ >= MAX_PRUNE_CHECKS) break;
    const without = walls.filter((other) => other !== wall);
    const result = solveZip({ ...shape, walls: without }, { maxSolutions: 2, maxNodes: UNIQUENESS_NODE_BUDGET });
    nodes += result.nodes;
    if (result.unique) walls.splice(walls.indexOf(wall), 1);
  }
  return { walls, nodes };
}

/** Version 1 boards: a fully shuffled path, evenly spaced numbers, and walls wherever they remove a wrong solution. */
export function generateZipV1(spec: PuzzleSpec): GeneratedBoard {
  const tier = ZIP_TIERS[spec.difficulty];
  const key = zipSeeds.rngKey(spec);
  const size = spec.size ?? createRng(`${key}|size`).pick(tier.sizes);
  const maxWalls = Math.floor(size * size * tier.maxWallShare);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = createRng(`${key}|attempt|${attempt}`);
    const solution = randomHamiltonianPath(rng, size, size);
    const checkpoints = placeCheckpoints(rng, solution, size, tier);
    const shape: ZipShape = { width: size, height: size, checkpoints, walls: [] };
    const unique = wallsForUniqueness(rng, shape, solution, maxWalls);
    if (!unique) continue;
    const walls = [...unique.walls].sort((a, b) => a.a - b.a || a.b - b.b);
    return { size, checkpoints, walls, solution, attempts: attempt, solverNodes: unique.nodes, theme: { figure: "none", path: "random", symmetric: false } };
  }
  throw new Error(`No uniquely solvable board found for seed ${zipSeeds.format(spec)}`);
}
