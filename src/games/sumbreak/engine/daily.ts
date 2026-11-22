import * as daily from "@/shared/engine/daily";
import { type DateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import { generateSumbreakFromSpec } from "./generator";
import { type PuzzleSpec, SUMBREAK_GENERATOR_VERSION, sumbreakSeeds } from "./seed";
import type { SumbreakPuzzle } from "./types";

/** Puzzle #1 falls on 2026-11-18, the day LinkedIn's Sumbreak launched, so numbers line up with it. */
export const SUMBREAK_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2026-11-18",
  schedule: daily.DEFAULT_WEEKLY_SCHEDULE,
  generatorVersion: SUMBREAK_GENERATOR_VERSION,
};

export const getSumbreakDailyInfo = (date: DateKey, config = SUMBREAK_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(sumbreakSeeds, config, date);
export const sumbreakDailyDateFromSpec = (spec: PuzzleSpec, config = SUMBREAK_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(sumbreakSeeds, config, spec);

/** Daily puzzle for a Pacific calendar date, or for the Pacific date of an instant. */
export function getSumbreakDailyPuzzle(when: DateKey | Date, config = SUMBREAK_DAILY_CONFIG): { info: daily.DailyInfo; puzzle: SumbreakPuzzle } {
  const date = typeof when === "string" ? when : pacificDateKey(when);
  const info = getSumbreakDailyInfo(date, config);
  return { info, puzzle: generateSumbreakFromSpec(info.spec) };
}
