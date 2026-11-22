import * as daily from "@/shared/engine/daily";
import { type DateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import { generateChessFromSpec } from "./generator";
import { CHESS_GENERATOR_VERSION, type PuzzleSpec, chessSeeds } from "./seed";
import type { ChessPuzzle } from "./types";

/** Puzzle #1 falls on the day Chess joined the platform. */
export const CHESS_DAILY_CONFIG: daily.DailyConfig = {
  epoch: "2026-11-22",
  schedule: daily.DEFAULT_WEEKLY_SCHEDULE,
  generatorVersion: CHESS_GENERATOR_VERSION,
};

export const getChessDailyInfo = (date: DateKey, config = CHESS_DAILY_CONFIG): daily.DailyInfo => daily.getDailyInfo(chessSeeds, config, date);
export const chessDailyDateFromSpec = (spec: PuzzleSpec, config = CHESS_DAILY_CONFIG): DateKey | null => daily.dailyDateFromSpec(chessSeeds, config, spec);

/** Daily puzzle for a Pacific calendar date, or for the Pacific date of an instant. */
export function getChessDailyPuzzle(when: DateKey | Date, config = CHESS_DAILY_CONFIG): { info: daily.DailyInfo; puzzle: ChessPuzzle } {
  const date = typeof when === "string" ? when : pacificDateKey(when);
  const info = getChessDailyInfo(date, config);
  return { info, puzzle: generateChessFromSpec(info.spec) };
}
