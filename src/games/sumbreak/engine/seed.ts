import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";

/**
 * Bump this whenever a generator change would alter the puzzle a seed produces.
 * Keep the old code path and add the new number to the supported list.
 */
export const SUMBREAK_GENERATOR_VERSION = 1;
export const SUMBREAK_MIN_SIZE = 3;
export const SUMBREAK_MAX_SIZE = 5;

/** Seeds look like `SUMBREAK:2026-11-23:1:easy` or `SUMBREAK:lucky:1:hard:4`. */
export const sumbreakSeeds = createSeedCodec({
  prefix: "SUMBREAK",
  currentVersion: SUMBREAK_GENERATOR_VERSION,
  supportedVersions: [1],
  minSize: SUMBREAK_MIN_SIZE,
  maxSize: SUMBREAK_MAX_SIZE,
});

export const formatSumbreakSeed = (spec: PuzzleSpec): string => sumbreakSeeds.format(spec);
