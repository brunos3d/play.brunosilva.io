"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Clock, IDLE_CLOCK, clockElapsed, finishClock, isClockRunning, startClock } from "@/shared/engine/clock";

const DISPLAY_TICK_MS = 250;

/**
 * React wrapper around the wall clock. The clock itself is data in a ref, so
 * re-renders never touch it. The tick only refreshes what is shown. Because
 * elapsed time is "now minus the start instant", a hidden tab, a reload or a
 * closed browser cannot stop it: the value is simply recomputed on return.
 */
export function useGameClock() {
  const clockRef = useRef<Clock>(IDLE_CLOCK);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  const sync = useCallback(() => {
    setElapsed(clockElapsed(clockRef.current, Date.now()));
    setRunning(isClockRunning(clockRef.current));
  }, []);

  /** Starts the clock on the first look at the board. Returns true only when this call started it. */
  const begin = useCallback((): boolean => {
    const next = startClock(clockRef.current, Date.now());
    if (next === clockRef.current) return false;
    clockRef.current = next;
    sync();
    return true;
  }, [sync]);

  /** Stops the clock for good and returns the final time. */
  const finish = useCallback((): number => {
    clockRef.current = finishClock(clockRef.current, Date.now());
    sync();
    return clockElapsed(clockRef.current, Date.now());
  }, [sync]);

  const restore = useCallback(
    (clock: Clock) => {
      clockRef.current = clock;
      sync();
    },
    [sync],
  );

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(sync, DISPLAY_TICK_MS);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [running, sync]);

  return { clockRef, elapsed, running, begin, finish, restore };
}
