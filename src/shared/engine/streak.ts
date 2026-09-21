import { type DateKey, daysBetween } from "@/shared/engine/pacific-time";

export type StreakSummary = {
  current: number;
  longest: number;
  /** Most recent completed date, if any. */
  lastCompleted: DateKey | null;
};

/**
 * Derives streaks from the set of completed Pacific dates.
 *
 * The current streak stays alive while today's puzzle is still unsolved: it
 * counts the run that ends today or yesterday. A run that ended earlier is
 * broken and reports 0.
 */
export function computeStreak(
  completedDates: readonly DateKey[],
  today: DateKey,
): StreakSummary {
  const dates = [...new Set(completedDates)].sort();
  if (dates.length === 0) return { current: 0, longest: 0, lastCompleted: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = daysBetween(dates[i - 1], dates[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const lastCompleted = dates[dates.length - 1];
  const gap = daysBetween(lastCompleted, today);
  const current = gap === 0 || gap === 1 ? run : 0;

  return { current, longest, lastCompleted };
}
