import type { Difficulty } from "@/shared/engine/difficulty";
import { hashHex } from "@/shared/engine/prng";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { buildTopology } from "../grid";
import { validateQueens, validateShape } from "../rules";
import { type PuzzleSpec, QUEENS_GENERATOR_VERSION, queensSeeds } from "../seed";
import { deduce } from "../solver/logic";
import { solveQueens } from "../solver/search";
import type { QueensPuzzle } from "../types";
import { type GeneratedBoard, generateQueensV1 } from "./v1";

const VERSIONS: Record<number, (spec: PuzzleSpec) => GeneratedBoard> = { 1: generateQueensV1 };

/** Id of the puzzle a canonical seed builds. Lets the hub look up a saved board without generating it. */
export const queensPuzzleId = (shareSeed: string): string => `queens-${hashHex(shareSeed).slice(0, 12)}`;

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version, difficulty and size, each attempt has its own
 * stream, and the solvers work on node budgets, never on a clock. The version
 * in the spec selects the generator, so an old seed keeps its old board.
 */
export function generateQueensFromSpec(spec: PuzzleSpec): QueensPuzzle {
  if (!queensSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !queensSeeds.isBoardSize(spec.size)) throw new RangeError(`Board size ${spec.size} is out of range.`);

  const board = VERSIONS[spec.version](spec);
  const shareSeed = queensSeeds.format({ ...spec, token: normalizeToken(spec.token) });
  const regionSizes = new Array<number>(board.size).fill(0);
  for (const region of board.regions) regionSizes[region]++;
  return {
    id: queensPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    size: board.size,
    difficulty: spec.difficulty,
    regions: board.regions,
    solution: board.solution,
    metadata: {
      generatorVersion: spec.version,
      shareSeed,
      attempts: board.attempts,
      solverNodes: board.solverNodes,
      steps: board.deduction.steps.length,
      maxLevel: board.deduction.maxLevel,
      score: board.deduction.score,
      levels: board.deduction.levels,
      regionSizes,
    },
  };
}

/** `generateQueensPuzzle("example-seed", "hard")` always returns the same puzzle. */
export function generateQueensPuzzle(seed: string | number, difficulty: Difficulty, options: { size?: number; version?: number } = {}): QueensPuzzle {
  return generateQueensFromSpec({
    token: normalizeToken(seed),
    version: options.version ?? QUEENS_GENERATOR_VERSION,
    difficulty,
    ...(options.size !== undefined ? { size: options.size } : {}),
  });
}

/** Independent audit of a finished puzzle: the regions are well formed, the stored queens are legal, the search solver agrees they are the only solution, and deduction alone finds them. */
export function validateQueensPuzzle(puzzle: QueensPuzzle): { ok: boolean; problems: string[] } {
  const problems = validateShape(puzzle);
  if (problems.length > 0) return { ok: false, problems };
  const topology = buildTopology(puzzle);
  if (!validateQueens(topology, puzzle.solution).complete) problems.push("Stored solution breaks the rules.");
  const result = solveQueens(puzzle, { maxSolutions: 2 }, topology);
  if (!result.exhausted) problems.push("Solver ran out of budget.");
  if (result.solutionCount !== 1) problems.push(`Solver finds ${result.solutionCount} solutions.`);
  else if (result.solutions[0].some((cell, row) => cell !== puzzle.solution[row])) problems.push("Stored solution differs from the solver's.");
  const deduction = deduce(topology);
  if (!deduction.solved) problems.push("Deduction alone does not finish the board.");
  else if ([...deduction.queens].sort((a, b) => a - b).some((cell, row) => cell !== puzzle.solution[row])) problems.push("Deduction reaches a different solution.");
  return { ok: problems.length === 0, problems };
}
