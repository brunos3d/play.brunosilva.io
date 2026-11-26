"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type Clock, IDLE_CLOCK, clockElapsed, finishClock, isClockRunning, startClock } from "@/shared/engine/clock";

const DISPLAY_TICK_MS = 250;

/**
 * When the player first opened this puzzle on any of their devices, on this
 * device's clock, or null when this device is the first. The daily page
 * provides it from the server's record (see daily-gate.tsx). A clock that
 * starts or resumes under it never starts later than that instant, so leaving
 * a puzzle on the phone and finishing it on the computer counts the whole time.
 */
export const ClockStartContext = createContext<number | null>(null);

/**
 * React wrapper around the wall clock. The clock itself is data in a ref, so
 * re-renders never touch it. The tick only refreshes what is shown. Because
 * elapsed time is "now minus the start instant", a hidden tab, a reload or a
 * closed browser cannot stop it: the value is simply recomputed on return.
 */
export function useGameClock() {
  const clockRef = useRef<Clock>(IDLE_CLOCK);
  const firstOpened = useContext(ClockStartContext);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  const sync = useCallback(() => {
    setElapsed(clockElapsed(clockRef.current, Date.now()));
    setRunning(isClockRunning(clockRef.current));
  }, []);

  /** Starts the clock on the first look at the board. Returns true only when this call started it. */
  const begin = useCallback((): boolean => {
    const now = Date.now();
    const next = startClock(clockRef.current, firstOpened !== null && firstOpened < now ? firstOpened : now);
    if (next === clockRef.current) return false;
    clockRef.current = next;
    sync();
    return true;
  }, [firstOpened, sync]);

  /** Stops the clock for good and returns the final time. */
  const finish = useCallback((): number => {
    clockRef.current = finishClock(clockRef.current, Date.now());
    sync();
    return clockElapsed(clockRef.current, Date.now());
  }, [sync]);

  const restore = useCallback(
    (clock: Clock) => {
      // A board this device started later than another device did runs on the earlier start.
      const early = firstOpened !== null && clock.finishedMs === null && clock.startedAt !== null && firstOpened < clock.startedAt;
      clockRef.current = early ? { ...clock, startedAt: firstOpened } : clock;
      sync();
    },
    [firstOpened, sync],
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
