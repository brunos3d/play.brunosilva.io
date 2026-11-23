import { hashHex } from "@/shared/engine/prng";
import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";

/**
 * Bump this whenever a generator change would alter the words a seed produces.
 * Keep the old code path and add the new number to the supported list. A change
 * to the answer list changes puzzles too, so it also needs a new version.
 */
export const TERMO_GENERATOR_VERSION = 1;
/** Every word has five letters. The seed codec calls that the board size. */
export const TERMO_WORD_LENGTH = 5;

/** Seeds look like `TERMO:2026-11-23:1:easy` or `TERMO:lucky:1:hard`. */
export const termoSeeds = createSeedCodec({
  prefix: "TERMO",
  currentVersion: TERMO_GENERATOR_VERSION,
  supportedVersions: [1],
  minSize: TERMO_WORD_LENGTH,
  maxSize: TERMO_WORD_LENGTH,
});

export const formatTermoSeed = (spec: PuzzleSpec): string => termoSeeds.format(spec);

/**
 * Id of the puzzle a canonical seed builds. It lives here, away from the
 * generator, so the hub can look up a saved board without loading the word lists.
 */
export const termoPuzzleId = (shareSeed: string): string => `termo-${hashHex(shareSeed).slice(0, 12)}`;
