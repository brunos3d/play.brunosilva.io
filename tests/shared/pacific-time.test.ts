import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  daysBetween,
  isDateKey,
  msUntilPacificMidnight,
  pacificDateKey,
} from "@/shared/engine/pacific-time";
import { computeStreak } from "@/shared/engine/streak";

const HOUR = 3_600_000;

describe("pacific date", () => {
  it("uses Los Angeles, not UTC, for the calendar date", () => {
    // 06:59 UTC is 23:59 PDT on the previous day.
    expect(pacificDateKey(new Date("2026-09-21T06:59:59Z"))).toBe("2026-09-20");
    expect(pacificDateKey(new Date("2026-09-21T07:00:00Z"))).toBe("2026-09-21");
  });

  it("follows standard time in winter", () => {
    expect(pacificDateKey(new Date("2026-01-15T07:59:59Z"))).toBe("2026-01-14");
    expect(pacificDateKey(new Date("2026-01-15T08:00:00Z"))).toBe("2026-01-15");
  });

  it("does not depend on the process timezone", () => {
    const original = process.env.TZ;
    const instant = new Date("2026-09-21T06:30:00Z");
    try {
      for (const zone of ["Asia/Tokyo", "America/Sao_Paulo", "UTC"]) {
        process.env.TZ = zone;
        expect(pacificDateKey(instant)).toBe("2026-09-20");
      }
    } finally {
      process.env.TZ = original;
    }
  });

  it("validates date keys", () => {
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-2-3")).toBe(false);
    expect(isDateKey("today")).toBe(false);
  });

  it("does calendar arithmetic across months, years and leap days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
    expect(dayOfWeek("2026-09-21")).toBe(1);
    expect(dayOfWeek("2026-09-27")).toBe(0);
  });
});

describe("rollover countdown", () => {
  it("counts down to the next Pacific midnight", () => {
    expect(msUntilPacificMidnight(new Date("2026-09-21T06:00:00Z"))).toBe(HOUR);
    expect(msUntilPacificMidnight(new Date("2026-09-21T07:00:00Z"))).toBe(24 * HOUR);
  });

  it("handles the 23 hour day when DST starts", () => {
    // 2026-03-08 00:00 PST = 08:00 UTC. The day ends at 07:00 UTC on the 9th.
    expect(msUntilPacificMidnight(new Date("2026-03-08T08:00:00Z"))).toBe(23 * HOUR);
  });

  it("handles the 25 hour day when DST ends", () => {
    // 2026-11-01 00:00 PDT = 07:00 UTC. The day ends at 08:00 UTC on the 2nd.
    expect(msUntilPacificMidnight(new Date("2026-11-01T07:00:00Z"))).toBe(25 * HOUR);
  });

  it("always lands exactly on a date change", () => {
    for (let i = 0; i < 400; i++) {
      const instant = new Date(Date.UTC(2026, 0, 1) + i * 23.37 * HOUR);
      const target = instant.getTime() + msUntilPacificMidnight(instant);
      expect(pacificDateKey(new Date(target))).not.toBe(pacificDateKey(instant));
      expect(pacificDateKey(new Date(target - 1))).toBe(pacificDateKey(instant));
    }
  });
});

describe("streak", () => {
  it("is zero with no completions", () => {
    expect(computeStreak([], "2026-09-21")).toEqual({ current: 0, longest: 0, lastCompleted: null });
  });

  it("counts a run that ends today", () => {
    const summary = computeStreak(["2026-09-19", "2026-09-20", "2026-09-21"], "2026-09-21");
    expect(summary.current).toBe(3);
    expect(summary.longest).toBe(3);
  });

  it("keeps the streak alive until today's puzzle is missed", () => {
    expect(computeStreak(["2026-09-19", "2026-09-20"], "2026-09-21").current).toBe(2);
    expect(computeStreak(["2026-09-19", "2026-09-20"], "2026-09-22").current).toBe(0);
  });

  it("tracks the longest run separately from the current one", () => {
    const summary = computeStreak(
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-20", "2026-09-21"],
      "2026-09-21",
    );
    expect(summary.current).toBe(2);
    expect(summary.longest).toBe(4);
  });

  it("ignores duplicates, ordering and month boundaries", () => {
    const summary = computeStreak(
      ["2026-10-01", "2026-09-30", "2026-09-30", "2026-09-29"],
      "2026-10-01",
    );
    expect(summary.current).toBe(3);
  });

  it("does not count completions dated after today", () => {
    expect(computeStreak(["2026-09-25"], "2026-09-21").current).toBe(0);
  });
});
