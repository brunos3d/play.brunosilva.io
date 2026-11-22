import * as daily from "@/shared/engine/daily";
import { type DateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import { generateQueensFromSpec } from "./generator";
import { type PuzzleSpec, QUEENS_GENERATOR_VERSION, queensSeeds } from "./seed";
import type { QueensPuzzle } from "./types";

/** Puzzle #1 falls on 2026-11-22, the day Queens joined the platform. */
export const QUEENS_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2026-11-22",
  schedule: daily.DEFAULT_WEEKLY_SCHEDULE,
  generatorVersion: QUEENS_GENERATOR_VERSION,
};

export const getQueensDailyInfo = (date: DateKey, config = QUEENS_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(queensSeeds, config, date);
export const queensDailyDateFromSpec = (spec: PuzzleSpec, config = QUEENS_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(queensSeeds, config, spec);

/** Daily puzzle for a Pacific calendar date, or for the Pacific date of an instant. */
export function getQueensDailyPuzzle(when: DateKey | Date, config = QUEENS_DAILY_CONFIG): { info: daily.DailyInfo; puzzle: QueensPuzzle } {
  const date = typeof when === "string" ? when : pacificDateKey(when);
  const info = getQueensDailyInfo(date, config);
  return { info, puzzle: generateQueensFromSpec(info.spec) };
}
