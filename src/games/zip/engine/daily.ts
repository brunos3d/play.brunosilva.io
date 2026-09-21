import * as daily from "@/shared/engine/daily";
import { type DateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import { generateZipFromSpec } from "./generator";
import { type PuzzleSpec, ZIP_GENERATOR_VERSION, zipSeeds } from "./seed";
import type { ZipPuzzle } from "./types";

/** Puzzle #1 falls on 2025-03-18, the day the original Zip launched. */
export const ZIP_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2025-03-18",
  schedule: daily.DEFAULT_WEEKLY_SCHEDULE,
  generatorVersion: ZIP_GENERATOR_VERSION,
};

export const getZipDailyInfo = (date: DateKey, config = ZIP_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(zipSeeds, config, date);
export const zipDailyDateFromSpec = (spec: PuzzleSpec, config = ZIP_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(zipSeeds, config, spec);

/** Daily puzzle for a Pacific calendar date, or for the Pacific date of an instant. */
export function getZipDailyPuzzle(when: DateKey | Date, config = ZIP_DAILY_CONFIG): { info: daily.DailyInfo; puzzle: ZipPuzzle } {
  const date = typeof when === "string" ? when : pacificDateKey(when);
  const info = getZipDailyInfo(date, config);
  return { info, puzzle: generateZipFromSpec(info.spec) };
}
