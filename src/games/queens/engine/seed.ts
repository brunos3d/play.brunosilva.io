import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";

/**
 * Bump this whenever a generator change would alter the puzzle a seed produces.
 * Keep the old code path and add the new number to the supported list.
 */
export const QUEENS_GENERATOR_VERSION = 1;
export const QUEENS_MIN_SIZE = 5;
export const QUEENS_MAX_SIZE = 10;

/** Seeds look like `QUEENS:2026-11-22:1:hard` or `QUEENS:lucky:1:easy:8`. */
export const queensSeeds = createSeedCodec({
  prefix: "QUEENS",
  currentVersion: QUEENS_GENERATOR_VERSION,
  supportedVersions: [1],
  minSize: QUEENS_MIN_SIZE,
  maxSize: QUEENS_MAX_SIZE,
});

export const formatQueensSeed = (spec: PuzzleSpec): string => queensSeeds.format(spec);
