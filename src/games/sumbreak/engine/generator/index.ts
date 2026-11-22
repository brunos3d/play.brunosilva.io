import type { Difficulty } from "@/shared/engine/difficulty";
import { hashHex } from "@/shared/engine/prng";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { countTiles, legalMerges, replayMerges } from "../rules";
import { type PuzzleSpec, SUMBREAK_GENERATOR_VERSION, sumbreakSeeds } from "../seed";
import { SumbreakSolver } from "../solver";
import type { SumbreakPuzzle, SumbreakShape } from "../types";
import { type GeneratedBoard, generateSumbreakV1 } from "./v1";

const VERSIONS: Record<number, (spec: PuzzleSpec) => GeneratedBoard> = { 1: generateSumbreakV1 };

/** Id of the puzzle a canonical seed builds. Lets the hub look up a saved board without generating it. */
export const sumbreakPuzzleId = (shareSeed: string): string => `sumbreak-${hashHex(shareSeed).slice(0, 12)}`;

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version, difficulty and size, each candidate board has its
 * own stream, and the solver works on a node budget, never on a clock.
 */
export function generateSumbreakFromSpec(spec: PuzzleSpec): SumbreakPuzzle {
  if (!sumbreakSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !sumbreakSeeds.isBoardSize(spec.size)) throw new RangeError(`Board size ${spec.size} is out of range.`);

  const board = VERSIONS[spec.version](spec);
  const shareSeed = sumbreakSeeds.format({ ...spec, token: normalizeToken(spec.token) });
  return {
    id: sumbreakPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    size: board.size,
    cells: board.cells,
    difficulty: spec.difficulty,
    total: board.total,
    solution: board.solution,
    metadata: {
      generatorVersion: spec.version,
      shareSeed,
      attempts: board.attempts,
      solverNodes: board.solverNodes,
      winChance: board.winChance,
      openingMoves: legalMerges(board.size, board.cells).length,
    },
  };
}

export function generateSumbreakPuzzle(seed: string | number, difficulty: Difficulty, options: { size?: number; version?: number } = {}): SumbreakPuzzle {
  return generateSumbreakFromSpec({ token: normalizeToken(seed), version: options.version ?? SUMBREAK_GENERATOR_VERSION, difficulty, ...(options.size !== undefined ? { size: options.size } : {}) });
}

export type PuzzleCheck = { ok: boolean; problems: string[] };

/** Independent check of a finished puzzle: the stored solution replays through the rules to one tile, and the solver agrees the board can be finished. */
export function validateSumbreakPuzzle(puzzle: SumbreakShape & { solution: readonly { from: number; to: number }[]; total?: number }): PuzzleCheck {
  const problems: string[] = [];
  const { size, cells } = puzzle;
  if (cells.length !== size * size) problems.push("The board does not match its size.");
  if (cells.some((value) => !Number.isInteger(value) || value < 0)) problems.push("A cell holds something that is not a number.");
  const end = replayMerges(size, cells, puzzle.solution);
  if (!end) problems.push("The stored solution has an illegal merge.");
  else if (countTiles(end) !== 1) problems.push("The stored solution does not end with one tile.");
  const sum = cells.reduce((total, value) => total + value, 0);
  if (puzzle.total !== undefined && puzzle.total !== sum) problems.push("The total is not the sum of the tiles.");
  if (end && Math.max(...end) !== sum) problems.push("The last tile is not the sum of the tiles.");
  if (!new SumbreakSolver(size).isSolvable(cells)) problems.push("The solver cannot finish the board.");
  return { ok: problems.length === 0, problems };
}
