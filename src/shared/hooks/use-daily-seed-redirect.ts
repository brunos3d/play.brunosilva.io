"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { type DateKey, addDays, pacificDateKey } from "@/shared/engine/pacific-time";

/**
 * Sends the seed of a daily that can still count, today's or yesterday's, to
 * the daily page. `date` is the daily date the seed names, or null for any
 * other seed. The page it lands on shows today's puzzle in the player's game
 * language, which for yesterday's seed, or another language's, is not the
 * puzzle the seed named: what matters is that it does not open as practice.
 *
 * The seed of a daily is an ordinary seed, so it could be typed into
 * /zip/play as practice: the same board, stored under the same key, with a
 * Reveal that shows the solution and closes nothing. Played from its own page
 * it is the daily, with everything that goes with it.
 */
export function useDailySeedRedirect(path: string, date: DateKey | null): void {
  const router = useRouter();
  useEffect(() => {
    if (!date) return;
    const today = pacificDateKey(new Date());
    if (date === today || date === addDays(today, -1)) router.replace(path);
  }, [date, path, router]);
}
