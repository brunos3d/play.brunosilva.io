import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";

/**
 * Bump this whenever a generator change would alter the puzzle a seed produces.
 * Keep the old code path and add the new number to the supported list.
 */
export const ZIP_GENERATOR_VERSION = 1;
export const ZIP_MIN_SIZE = 5;
export const ZIP_MAX_SIZE = 8;

/** Seeds look like `ZIP:2026-09-21:1:hard` or `ZIP:lucky:1:easy:8`. */
export const zipSeeds = createSeedCodec({
  prefix: "ZIP",
  currentVersion: ZIP_GENERATOR_VERSION,
  supportedVersions: [1],
  minSize: ZIP_MIN_SIZE,
  maxSize: ZIP_MAX_SIZE,
});

export const formatZipSeed = (spec: PuzzleSpec): string => zipSeeds.format(spec);
