import type { GameId } from "@/games/registry";
import type { Difficulty } from "@/shared/engine/difficulty";
import type { DateKey } from "@/shared/engine/pacific-time";
import { STORES, idbGet, idbGetAll, idbSet } from "./idb";

/**
 * Storage that every game shares. Keys carry the game id, so one database
 * serves the whole platform. Each game owns the shape of its board snapshot and
 * validates it on load. This module only moves it in and out of IndexedDB.
 */
export type DailyResult = {
  game: GameId;
  date: DateKey;
  number: number;
  difficulty: Difficulty;
  seed: string;
  elapsedMs: number;
  hintsUsed: number;
  /** Redraws in Patches, backtracks in Zip. */
  mistakes: number;
  moves: number;
  /** The player asked for the solution. The day is over, but it earns no streak and no best time. */
  revealed: boolean;
};

export type BestTime = { key: string; elapsedMs: number; seed: string };

const boardKey = (game: GameId, puzzleId: string): string => `${game}:${puzzleId}`;
const dailyKey = (game: GameId, date: DateKey): string => `${game}:${date}`;

export function saveBoard(game: GameId, puzzleId: string, snapshot: unknown): Promise<void> {
  return idbSet(STORES.games, boardKey(game, puzzleId), snapshot);
}

export function loadBoard(game: GameId, puzzleId: string): Promise<unknown> {
  return idbGet<unknown>(STORES.games, boardKey(game, puzzleId));
}

/** The first result of a date is the one that counts. Replays do not overwrite it. */
export async function saveDailyResult(result: DailyResult): Promise<DailyResult> {
  const key = dailyKey(result.game, result.date);
  const existing = await idbGet<DailyResult>(STORES.daily, key);
  if (existing) return existing;
  await idbSet(STORES.daily, key, result);
  return result;
}

export function loadDailyResult(game: GameId, date: DateKey): Promise<DailyResult | undefined> {
  return idbGet<DailyResult>(STORES.daily, dailyKey(game, date));
}

export async function loadDailyResults(game: GameId): Promise<DailyResult[]> {
  return (await idbGetAll<DailyResult>(STORES.daily)).filter((result) => result.game === game);
}

/** Dates that count toward a streak: solved by the player, not revealed. */
export function streakDates(results: readonly DailyResult[]): DateKey[] {
  return results.filter((result) => !result.revealed).map((result) => result.date);
}

export function bestTimeKey(game: GameId, difficulty: Difficulty, size: number): string {
  return `best:${game}:${difficulty}:${size}`;
}

/** Records a time if it beats the stored best. Returns the best after the update and whether it is new. */
export async function recordBestTime(game: GameId, difficulty: Difficulty, size: number, elapsedMs: number, seed: string): Promise<{ best: BestTime; isNew: boolean }> {
  const key = bestTimeKey(game, difficulty, size);
  const existing = await idbGet<BestTime>(STORES.stats, key);
  if (existing && existing.elapsedMs <= elapsedMs) return { best: existing, isNew: false };
  const best: BestTime = { key, elapsedMs, seed };
  await idbSet(STORES.stats, key, best);
  return { best, isNew: true };
}

export function loadBestTime(game: GameId, difficulty: Difficulty, size: number): Promise<BestTime | undefined> {
  return idbGet<BestTime>(STORES.stats, bestTimeKey(game, difficulty, size));
}
