import * as daily from "@/shared/engine/daily";
import { type DateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import type { Difficulty } from "@/shared/engine/difficulty";
import { generateFromSpec } from "../generator/generate";
import { GENERATOR_VERSION, type PuzzleSpec, patchesSeeds } from "../seed/spec";
import type { Puzzle } from "../types";

export type { DailyConfig, DailyInfo, WeeklySchedule } from "@/shared/engine/daily";

/** Puzzle #1 falls on the original game's launch day, so numbers line up with it. */
export const DEFAULT_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2026-03-18",
  schedule: daily.DEFAULT_WEEKLY_SCHEDULE,
  generatorVersion: GENERATOR_VERSION,
};

export const dailyDifficulty = (date: DateKey, config = DEFAULT_DAILY_CONFIG): Difficulty => daily.dailyDifficulty(patchesSeeds, config, date);
export const dailyNumber = (date: DateKey, config = DEFAULT_DAILY_CONFIG): number => daily.dailyNumber(config, date);
export const getDailyInfo = (date: DateKey, config = DEFAULT_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(patchesSeeds, config, date);
export const dailyDateFromSpec = (spec: PuzzleSpec, config = DEFAULT_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(patchesSeeds, config, spec);

/**
 * Daily puzzle for a Pacific calendar date, or for the Pacific date of an
 * instant. The player's own timezone is never consulted.
 */
export function getDailyPuzzle(when: DateKey | Date, config = DEFAULT_DAILY_CONFIG): { info: daily.DailyInfo; puzzle: Puzzle } {
  const date = typeof when === "string" ? when : pacificDateKey(when);
  const info = getDailyInfo(date, config);
  return { info, puzzle: generateFromSpec(info.spec) };
}
