import type { GameId } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import type { Difficulty } from "@/shared/engine/difficulty";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { computeStreak } from "@/shared/engine/streak";
import { loadBestTime, loadDailyResult, loadDailyResults, recordBestTime, saveDailyResult, streakDates } from "@/shared/storage/progress";
import type { ResultData } from "@/shared/ui/result-dialog";

/** What a game reports when a puzzle ends. */
export type FinishSummary = { elapsedMs: number; hintsUsed: number; mistakes: number; moves: number; revealed: boolean };

type Input = {
  game: GameId;
  daily?: DailyInfo;
  difficulty: Difficulty;
  size: number;
  seed: string;
  summary: FinishSummary;
  /** False when a finished board is reopened: read what was stored, record nothing. */
  record: boolean;
  shareUrl: string;
};

/**
 * Turns a finished puzzle into what the result screen shows, and records it.
 * The first result of a daily date is the one that counts, so a replay shows
 * the stored numbers. A revealed puzzle is stored too, which closes the day,
 * but it earns no streak and no best time.
 */
export async function buildResult({ game, daily, difficulty, size, seed, summary, record, shareUrl }: Input): Promise<ResultData> {
  let shown = summary;
  let streak: ResultData["streak"];

  if (daily) {
    const stored = record
      ? await saveDailyResult({ game, date: daily.date, number: daily.number, difficulty: daily.difficulty, seed: daily.seed, ...summary })
      : await loadDailyResult(game, daily.date);
    if (stored) shown = { elapsedMs: stored.elapsedMs, hintsUsed: stored.hintsUsed, mistakes: stored.mistakes, moves: stored.moves, revealed: stored.revealed };
    streak = computeStreak(streakDates(await loadDailyResults(game)), pacificDateKey(new Date()));
  }

  let best: ResultData["best"];
  if (!shown.revealed) {
    best = record
      ? await recordBestTime(game, difficulty, size, shown.elapsedMs, seed).then(({ best: entry, isNew }) => ({ elapsedMs: entry.elapsedMs, isNew }))
      : await loadBestTime(game, difficulty, size).then((entry) => (entry ? { elapsedMs: entry.elapsedMs, isNew: false } : undefined));
  }

  return { ...shown, dailyNumber: daily?.number, difficulty, size, streak, best, shareUrl };
}
