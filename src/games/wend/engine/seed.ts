import { LOCALES } from "@/i18n/config";
import { type GameLanguage, LEGACY_WORD_LANGUAGE } from "@/i18n/game-language";
import { hashHex } from "@/shared/engine/prng";
import { type PuzzleSpec, createSeedCodec } from "@/shared/engine/seed-codec";

export type { PuzzleSpec } from "@/shared/engine/seed-codec";

/**
 * Bump this whenever a generator change would alter the puzzle a seed produces.
 * Keep the old code path and add the new number to the supported list. A change
 * to the word bank changes puzzles too, so it also needs a new version.
 */
export const WEND_GENERATOR_VERSION = 1;
export const WEND_MIN_SIZE = 5;
export const WEND_MAX_SIZE = 8;

/** Seeds look like `WEND:2026-11-23:1:easy` or `WEND:lucky:1:hard:7`. */
export const wendSeeds = createSeedCodec({
  prefix: "WEND",
  currentVersion: WEND_GENERATOR_VERSION,
  supportedVersions: [1],
  minSize: WEND_MIN_SIZE,
  maxSize: WEND_MAX_SIZE,
  // The words exist in every interface language. A seed without a language is in Portuguese, the language the game shipped in.
  languages: { supported: LOCALES, legacy: LEGACY_WORD_LANGUAGE },
});

/** The language a spec's words are in. */
export const wendLanguage = (spec: PuzzleSpec): GameLanguage => (wendSeeds.languageOf(spec) ?? LEGACY_WORD_LANGUAGE) as GameLanguage;

export const formatWendSeed = (spec: PuzzleSpec): string => wendSeeds.format(spec);

/**
 * Id of the puzzle a canonical seed builds. It lives here, away from the
 * generator, so the hub can look up a saved board without loading the word bank.
 */
export const wendPuzzleId = (shareSeed: string): string => `wend-${hashHex(shareSeed).slice(0, 12)}`;
