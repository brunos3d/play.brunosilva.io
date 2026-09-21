"use client";

import { useEffect, useState } from "react";
import { type DateKey, msUntilPacificMidnight, pacificDateKey } from "@/shared/engine/pacific-time";

const ROLLOVER_SLACK_MS = 500;

/**
 * Today's Pacific date, read on the client after mount so server and client
 * markup always match. `playing` stays on the date the page opened with, and
 * `latest` follows the calendar. When they differ, the page offers the new
 * puzzle. It never swaps the board under a player who is mid-solve.
 */
export function useDailyDate(): { playing: DateKey | null; latest: DateKey | null; playLatest: () => void } {
  const [playing, setPlaying] = useState<DateKey | null>(null);
  const [latest, setLatest] = useState<DateKey | null>(null);

  useEffect(() => {
    let timeout = 0;
    const check = () => {
      const today = pacificDateKey(new Date());
      setLatest(today);
      setPlaying((current) => current ?? today);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(check, msUntilPacificMidnight(new Date()) + ROLLOVER_SLACK_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    timeout = window.setTimeout(check, 0);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { playing, latest, playLatest: () => setPlaying(latest) };
}
