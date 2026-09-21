import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_CONFIG,
  addDays,
  dailyDateFromSpec,
  dailyDifficulty,
  dailyNumber,
  getDailyInfo,
  getDailyPuzzle,
  parseSeed,
  validatePuzzle,
} from "@/games/patches/engine";

describe("daily puzzle", () => {
  it("numbers puzzles from the 2026-03-18 epoch, like the original", () => {
    expect(dailyNumber("2026-03-18")).toBe(1);
    expect(dailyNumber("2026-09-01")).toBe(168);
    expect(dailyNumber("2026-09-21")).toBe(188);
  });

  it("builds the documented seed format", () => {
    const info = getDailyInfo("2026-09-25");
    expect(info.seed).toBe("PATCHES:2026-09-25:1:hard");
    expect(parseSeed(info.seed)).toEqual(info.spec);
  });

  it("follows the weekly difficulty ramp", () => {
    // 2026-09-21 is a Monday.
    const week = Array.from({ length: 7 }, (_, i) => dailyDifficulty(addDays("2026-09-21", i)));
    expect(week[0]).toBe("easy");
    expect(["easy", "medium"]).toContain(week[1]);
    expect(week[2]).toBe("medium");
    expect(["medium", "hard"]).toContain(week[3]);
    expect(week[4]).toBe("hard");
    expect(week[5]).toBe("hard");
    expect(week[6]).toBe("expert");
  });

  it("uses both options on mixed days over time", () => {
    const tuesdays = new Set<string>();
    for (let week = 0; week < 30; week++) tuesdays.add(dailyDifficulty(addDays("2026-09-22", week * 7)));
    expect([...tuesdays].sort()).toEqual(["easy", "medium"]);
  });

  it("accepts a custom schedule and epoch", () => {
    const config = { ...DEFAULT_DAILY_CONFIG, epoch: "2026-01-01", schedule: { ...DEFAULT_DAILY_CONFIG.schedule, 1: ["expert"] as const } };
    expect(dailyDifficulty("2026-09-21", config)).toBe("expert");
    expect(dailyNumber("2026-01-10", config)).toBe(10);
  });

  it("gives every player the same puzzle for the same Pacific date", () => {
    const lateEvening = getDailyPuzzle(new Date("2026-09-22T06:59:00Z"));
    const earlyMorning = getDailyPuzzle(new Date("2026-09-21T07:00:00Z"));
    expect(lateEvening.info.date).toBe("2026-09-21");
    expect(lateEvening.puzzle).toEqual(earlyMorning.puzzle);
    expect(getDailyPuzzle("2026-09-21").puzzle).toEqual(earlyMorning.puzzle);
  });

  it("rolls over at Pacific midnight, not UTC or local midnight", () => {
    const before = getDailyPuzzle(new Date("2026-09-22T06:59:59Z"));
    const after = getDailyPuzzle(new Date("2026-09-22T07:00:00Z"));
    expect(before.info.number + 1).toBe(after.info.number);
    expect(before.puzzle.id).not.toBe(after.puzzle.id);
  });

  it("ignores the machine timezone", () => {
    const original = process.env.TZ;
    const instant = new Date("2026-09-21T23:30:00Z");
    try {
      const ids = ["Pacific/Auckland", "Europe/Lisbon", "America/Los_Angeles"].map((zone) => {
        process.env.TZ = zone;
        return getDailyPuzzle(instant).puzzle.id;
      });
      expect(new Set(ids).size).toBe(1);
    } finally {
      process.env.TZ = original;
    }
  });

  it("produces valid puzzles for a month of dates, all different", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 31; i++) {
      const { puzzle } = getDailyPuzzle(addDays("2026-09-01", i));
      expect(validatePuzzle(puzzle).problems, puzzle.seed).toEqual([]);
      ids.add(puzzle.id);
    }
    expect(ids.size).toBe(31);
  });

  it("recognizes daily seeds and rejects forged ones", () => {
    const info = getDailyInfo("2026-09-21");
    expect(dailyDateFromSpec(info.spec)).toBe("2026-09-21");
    expect(dailyDateFromSpec({ ...info.spec, difficulty: "expert" })).toBeNull();
    expect(dailyDateFromSpec({ ...info.spec, size: 8 })).toBeNull();
    expect(dailyDateFromSpec({ ...info.spec, token: "lucky" })).toBeNull();
  });

  it("rejects malformed dates", () => {
    expect(() => getDailyInfo("2026-13-40")).toThrow();
  });
});
