import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";
export { normalizeToken } from "@/shared/engine/seed-codec";
export { isDifficulty } from "@/shared/engine/difficulty";

/**
 * Bump this whenever a generator change would alter the puzzle a seed produces.
 * Keep the old code path and add the new number to SUPPORTED_VERSIONS, so old
 * seeds keep their boards and new seeds never collide with them.
 */
export const GENERATOR_VERSION = 1;
export const SUPPORTED_VERSIONS: readonly number[] = [1];
export const SEED_PREFIX = "PATCHES";
export const MIN_BOARD_SIZE = 5;
export const MAX_BOARD_SIZE = 10;

export const patchesSeeds = createSeedCodec({
  prefix: SEED_PREFIX,
  currentVersion: GENERATOR_VERSION,
  supportedVersions: SUPPORTED_VERSIONS,
  minSize: MIN_BOARD_SIZE,
  maxSize: MAX_BOARD_SIZE,
});

export const isBoardSize = patchesSeeds.isBoardSize;
export const isSupportedVersion = patchesSeeds.isSupportedVersion;
/** Canonical share seed, for example `PATCHES:2026-09-21:1:hard` or `PATCHES:lucky:1:easy:8`. */
export const formatSeed = (spec: PuzzleSpec): string => patchesSeeds.format(spec);
export const parseSeed = patchesSeeds.parse;
export const resolveSpec = patchesSeeds.resolve;
export const rngKey = patchesSeeds.rngKey;
