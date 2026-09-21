import type { Difficulty } from "@/shared/engine/difficulty";
import { hashHex } from "@/shared/engine/prng";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { buildTopology } from "../grid";
import { type PuzzleSpec, ZIP_GENERATOR_VERSION, zipSeeds } from "../seed";
import { solveZip } from "../solver";
import type { Checkpoint, Wall, ZipPuzzle } from "../types";
import { type TrapReport, measureTraps } from "./difficulty";
import { generateZipV1 } from "./v1";
import { generateZipV2 } from "./v2";

/** What a generator version hands back. Ids, the seed string and metadata are added here, the same way for every version. */
export type GeneratedBoard = {
  size: number;
  checkpoints: Checkpoint[];
  walls: Wall[];
  blocked?: number[];
  solution: number[];
  attempts: number;
  solverNodes: number;
  theme: { figure: string; path: string; symmetric: boolean };
  traps?: TrapReport;
};

const VERSIONS: Record<number, (spec: PuzzleSpec) => GeneratedBoard> = { 1: generateZipV1, 2: generateZipV2 };

/** Id of the puzzle a canonical seed builds. Lets the hub look up a saved board without generating it. */
export const zipPuzzleId = (shareSeed: string): string => `zip-${hashHex(shareSeed).slice(0, 12)}`;

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version, difficulty and size, each attempt has its own
 * stream, and the solver works on a node budget, never on a clock. The version
 * in the spec selects the generator, so an old seed keeps its old board.
 */
export function generateZipFromSpec(spec: PuzzleSpec): ZipPuzzle {
  if (!zipSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !zipSeeds.isBoardSize(spec.size)) throw new RangeError(`Board size ${spec.size} is out of range.`);

  const board = VERSIONS[spec.version](spec);
  const shareSeed = zipSeeds.format({ ...spec, token: normalizeToken(spec.token) });
  const shape = { width: board.size, height: board.size, checkpoints: board.checkpoints, walls: board.walls, blocked: board.blocked ?? [] };
  const traps = board.traps ?? measureTraps(shape, buildTopology(shape), board.solution);
  return {
    id: zipPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    ...shape,
    difficulty: spec.difficulty,
    solution: board.solution,
    metadata: {
      generatorVersion: spec.version,
      shareSeed,
      attempts: board.attempts,
      solverNodes: board.solverNodes,
      wallCount: board.walls.length,
      checkpointCount: board.checkpoints.length,
      hiddenCount: board.checkpoints.filter((checkpoint) => checkpoint.hidden).length,
      blockedCount: shape.blocked.length,
      theme: board.theme,
      trapScore: traps.score,
      deepTraps: traps.deepTraps,
    },
  };
}

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
