import type { Difficulty } from "@/shared/engine/difficulty";
import { type Rng, createRng, hashHex } from "@/shared/engine/prng";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { MIN_CHECKPOINTS, ZIP_TIERS, type ZipTier } from "./config";
import { buildTopology, cellAt, gridNeighbors, makeWall, wallKey } from "./grid";
import { type PuzzleSpec, ZIP_GENERATOR_VERSION, zipSeeds } from "./seed";
import { solveZip } from "./solver";
import type { Checkpoint, Wall, ZipPuzzle, ZipShape } from "./types";

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

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version, difficulty and size, each attempt has its own
 * stream, and the solver works on a node budget, never on a clock.
 */
export function generateZipFromSpec(spec: PuzzleSpec): ZipPuzzle {
  if (!zipSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !zipSeeds.isBoardSize(spec.size)) throw new RangeError(`Board size ${spec.size} is out of range.`);

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
    const shareSeed = zipSeeds.format({ ...spec, token: normalizeToken(spec.token) });
    return {
      id: zipPuzzleId(shareSeed),
      seed: shareSeed,
      version: spec.version,
      width: size,
      height: size,
      difficulty: spec.difficulty,
      checkpoints,
      walls,
      solution,
      metadata: { generatorVersion: spec.version, shareSeed, attempts: attempt, solverNodes: unique.nodes, wallCount: walls.length, checkpointCount: checkpoints.length },
    };
  }
  throw new Error(`No uniquely solvable board found for seed ${zipSeeds.format(spec)}`);
}

/** Id of the puzzle a canonical seed builds. Lets the hub look up a saved board without generating it. */
export const zipPuzzleId = (shareSeed: string): string => `zip-${hashHex(shareSeed).slice(0, 12)}`;

/** `generateZipPuzzle("example-seed", "hard")` always returns the same puzzle. */
export function generateZipPuzzle(seed: string | number, difficulty: Difficulty, options: { size?: number; version?: number } = {}): ZipPuzzle {
  return generateZipFromSpec({
    token: normalizeToken(seed),
    version: options.version ?? ZIP_GENERATOR_VERSION,
    difficulty,
    ...(options.size !== undefined ? { size: options.size } : {}),
  });
}

/** Independent audit of a finished puzzle: the stored path is legal and the solver agrees it is the only one. */
export function validateZipPuzzle(puzzle: ZipPuzzle): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const topology = buildTopology(puzzle);
  if (topology.start < 0) problems.push("No cell is numbered 1.");
  const numbers = puzzle.checkpoints.map((checkpoint) => checkpoint.number).sort((a, b) => a - b);
  if (numbers.some((number, index) => number !== index + 1)) problems.push("Checkpoint numbers are not 1..n.");
  const result = solveZip(puzzle, { maxSolutions: 2 }, topology);
  if (!result.exhausted) problems.push("Solver ran out of budget.");
  if (result.solutionCount !== 1) problems.push(`Solver finds ${result.solutionCount} solutions.`);
  else if (result.solutions[0].some((cell, index) => cell !== puzzle.solution[index])) problems.push("Stored solution differs from the solver's.");
  return { ok: problems.length === 0, problems };
}
