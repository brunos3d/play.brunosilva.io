import * as daily from "@/shared/engine/daily";
import type { DateKey } from "@/shared/engine/pacific-time";
import { type PuzzleSpec, WEND_GENERATOR_VERSION, wendSeeds } from "./seed";

/**
 * Puzzle #1 falls on 2026-06-09, the day LinkedIn's Wend launched, so numbers
 * line up with it. This module does not import the generator: the hub reads the
 * schedule from here and must not load the word bank to do it.
 */
export const WEND_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2026-06-09",
  schedule: daily.DEFAULT_WEEKLY_SCHEDULE,
  generatorVersion: WEND_GENERATOR_VERSION,
};

/** One daily puzzle per game language: the same date, number and tier, with that language's words. */
export const getWendDailyInfo = (date: DateKey, language?: string | null, config = WEND_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(wendSeeds, config, date, language);
export const wendDailyDateFromSpec = (spec: PuzzleSpec, config = WEND_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(wendSeeds, config, spec);
