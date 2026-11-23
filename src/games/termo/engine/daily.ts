import * as daily from "@/shared/engine/daily";
import type { Difficulty } from "@/shared/engine/difficulty";
import { type DateKey, isDateKey } from "@/shared/engine/pacific-time";
import { type PuzzleSpec, TERMO_GENERATOR_VERSION, termoSeeds } from "./seed";

/**
 * The daily puzzle is always one board: the classic game, one word in six
 * guesses, on every day of the week. Dueto and Quarteto are never the daily.
 * They are offered after it, as the day's extra puzzles (see below).
 */
const ONE_BOARD_EVERY_DAY: daily.WeeklySchedule = { 0: ["medium"], 1: ["medium"], 2: ["medium"], 3: ["medium"], 4: ["medium"], 5: ["medium"], 6: ["medium"] };

/**
 * Puzzle #1 falls on 2026-11-22, the day Termo joined the hub. This module does
 * not import the generator: the hub reads the schedule from here and must not
 * load the word lists to do it.
 */
export const TERMO_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2026-11-22",
  schedule: ONE_BOARD_EVERY_DAY,
  generatorVersion: TERMO_GENERATOR_VERSION,
};

export const getTermoDailyInfo = (date: DateKey, config = TERMO_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(termoSeeds, config, date);
export const termoDailyDateFromSpec = (spec: PuzzleSpec, config = TERMO_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(termoSeeds, config, spec);

/**
 * The day's Dueto and the day's Quarteto. Everyone gets the same words for a
 * date, but they are not "the daily": they have no number, they do not touch
 * the streak, and they are played through the ordinary seed route.
 *
 * Their seed token is the date plus the mode, such as `2026-11-23-dueto`. That
 * is not a bare date on purpose: a bare date is a daily seed, and the daily
 * deck would hand these puzzles the same word the day's Termo hides.
 */
export const TERMO_DAILY_VARIANTS = ["dueto", "quarteto"] as const;
export type TermoDailyVariant = (typeof TERMO_DAILY_VARIANTS)[number];

const VARIANT_TIER: Record<TermoDailyVariant, Difficulty> = { dueto: "hard", quarteto: "expert" };

export function termoDailyVariantSpec(date: DateKey, variant: TermoDailyVariant, config = TERMO_DAILY_CONFIG): PuzzleSpec {
  if (!isDateKey(date)) throw new RangeError(`Invalid daily date: ${date}`);
  return { token: `${date}-${variant}`, version: daily.dailyGeneratorVersion(config, date), difficulty: VARIANT_TIER[variant] };
}

/** Recognizes the seed of a day's Dueto or Quarteto. A forged tier, version or size does not match. */
export function termoDailyVariantFromSpec(spec: PuzzleSpec, config = TERMO_DAILY_CONFIG): { date: DateKey; variant: TermoDailyVariant } | null {
  const match = /^(\d{4}-\d{2}-\d{2})-([a-z]+)$/.exec(spec.token);
  if (!match || !isDateKey(match[1]) || spec.size !== undefined) return null;
  const variant = TERMO_DAILY_VARIANTS.find((name) => name === match[2]);
  if (!variant) return null;
  return termoSeeds.format(termoDailyVariantSpec(match[1], variant, config)) === termoSeeds.format(spec) ? { date: match[1], variant } : null;
}
