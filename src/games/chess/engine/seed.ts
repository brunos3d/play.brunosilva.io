import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";

/**
 * Bump this whenever a generator change would alter the puzzle a seed produces.
 * Keep the old code path and add the new number to the supported list.
 */
export const CHESS_GENERATOR_VERSION = 1;
/** Every chess board is 8x8. The codec still needs a range, and a seed never carries a size. */
export const CHESS_BOARD_SIZE = 8;

/** Seeds look like `CHESS:2026-11-22:1:hard` or `CHESS:lucky:1:easy`. */
export const chessSeeds = createSeedCodec({
  prefix: "CHESS",
  currentVersion: CHESS_GENERATOR_VERSION,
  supportedVersions: [1],
  minSize: CHESS_BOARD_SIZE,
  maxSize: CHESS_BOARD_SIZE,
});

export const formatChessSeed = (spec: PuzzleSpec): string => chessSeeds.format(spec);
