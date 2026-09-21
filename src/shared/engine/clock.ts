/**
 * Solve clock, as plain data.
 *
 * The clock runs on wall time on purpose. It starts the first time the player
 * sees the board and keeps counting while the tab is hidden, closed or
 * reloaded, so leaving to look something up does not stop it. Only finishing
 * the puzzle stops it. The start instant is persisted with the board, which is
 * all it takes to resume after a reload.
 *
 * The caller passes `now` (epoch milliseconds), so these functions stay pure.
 */
export type Clock = {
  /** Epoch milliseconds of the first look at the board. Null before that. */
  startedAt: number | null;
  /** Final time, set once when the puzzle ends. */
  finishedMs: number | null;
};

export const IDLE_CLOCK: Clock = { startedAt: null, finishedMs: null };

export function startClock(clock: Clock, now: number): Clock {
  return clock.startedAt === null && clock.finishedMs === null ? { startedAt: now, finishedMs: null } : clock;
}

export function clockElapsed(clock: Clock, now: number): number {
  if (clock.finishedMs !== null) return clock.finishedMs;
  if (clock.startedAt === null) return 0;
  // A system clock set backwards must not produce a negative time.
  return Math.max(0, Math.floor(now - clock.startedAt));
}

export function finishClock(clock: Clock, now: number): Clock {
  return clock.finishedMs !== null ? clock : { startedAt: clock.startedAt, finishedMs: clockElapsed(clock, now) };
}

export function isClockRunning(clock: Clock): boolean {
  return clock.startedAt !== null && clock.finishedMs === null;
}

/** Rebuilds a clock from storage. Anything malformed falls back to a fresh clock. */
export function restoreClock(startedAt: unknown, finishedMs: unknown): Clock {
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  return { startedAt: valid(startedAt) ? startedAt : null, finishedMs: valid(finishedMs) ? Math.floor(finishedMs) : null };
}

/** MM:SS. Minutes keep growing past 59 instead of rolling into hours. */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
