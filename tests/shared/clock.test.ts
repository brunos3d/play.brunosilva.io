import { describe, expect, it } from "vitest";
import { IDLE_CLOCK, clockElapsed, finishClock, formatTime, isClockRunning, restoreClock, startClock } from "@/shared/engine/clock";

const T0 = 1_790_000_000_000;

describe("wall clock", () => {
  it("does not run before the board is seen", () => {
    expect(clockElapsed(IDLE_CLOCK, T0)).toBe(0);
    expect(isClockRunning(IDLE_CLOCK)).toBe(false);
  });

  it("counts from the first look, and only the first start counts", () => {
    const clock = startClock(IDLE_CLOCK, T0);
    expect(clockElapsed(clock, T0 + 2_500)).toBe(2_500);
    expect(startClock(clock, T0 + 60_000)).toBe(clock);
  });

  it("keeps counting while the player is away: only the start instant is stored", () => {
    const stored = JSON.parse(JSON.stringify(startClock(IDLE_CLOCK, T0)));
    // Ten minutes later, after a closed tab and a reload.
    const back = restoreClock(stored.startedAt, stored.finishedMs);
    expect(isClockRunning(back)).toBe(true);
    expect(clockElapsed(back, T0 + 600_000)).toBe(600_000);
  });

  it("stops for good when the puzzle ends", () => {
    const finished = finishClock(startClock(IDLE_CLOCK, T0), T0 + 48_200);
    expect(finished.finishedMs).toBe(48_200);
    expect(clockElapsed(finished, T0 + 999_999)).toBe(48_200);
    expect(finishClock(finished, T0 + 999_999)).toBe(finished);
    expect(startClock(finished, T0 + 999_999)).toBe(finished);
    expect(isClockRunning(finished)).toBe(false);
  });

  it("never goes negative if the system clock is set backwards", () => {
    expect(clockElapsed(startClock(IDLE_CLOCK, T0), T0 - 5_000)).toBe(0);
  });

  it("treats malformed stored values as a fresh clock", () => {
    expect(restoreClock("yesterday", null)).toEqual(IDLE_CLOCK);
    expect(restoreClock(-5, Number.NaN)).toEqual(IDLE_CLOCK);
    expect(restoreClock(T0, 1234.9)).toEqual({ startedAt: T0, finishedMs: 1234 });
  });

  it("formats as MM:SS", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(48_999)).toBe("00:48");
    expect(formatTime(61_000)).toBe("01:01");
    expect(formatTime(3_725_000)).toBe("62:05");
    expect(formatTime(-5)).toBe("00:00");
  });
});
