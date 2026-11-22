import { describe, expect, it } from "vitest";
import { QUEENS_DAILY_CONFIG, getQueensDailyInfo, getQueensDailyPuzzle, queensDailyDateFromSpec, queensPuzzleId, queensSeeds, validateQueensPuzzle } from "@/games/queens/engine";
import { addDays } from "@/shared/engine/pacific-time";

describe("queens daily", () => {
  it("numbers puzzles from the day the game launched", () => {
    expect(QUEENS_DAILY_CONFIG.epoch).toBe("2026-11-22");
    expect(getQueensDailyInfo("2026-11-22").number).toBe(1);
    expect(getQueensDailyInfo("2026-12-01").number).toBe(10);
    expect(getQueensDailyInfo("2026-11-22").seed).toBe("QUEENS:2026-11-22:1:expert");
  });

  it("gets harder through the week and peaks on Sunday", () => {
    // 2026-11-23 is a Monday.
    expect(getQueensDailyInfo("2026-11-23").difficulty).toBe("easy");
    expect(getQueensDailyInfo("2026-11-25").difficulty).toBe("medium");
    expect(getQueensDailyInfo("2026-11-27").difficulty).toBe("hard");
    expect(getQueensDailyInfo("2026-11-29").difficulty).toBe("expert");
  });

  it("builds the same valid board for a date, from a date key or an instant", () => {
    const byDate = getQueensDailyPuzzle("2026-11-24");
    // 18:00 UTC on the 24th is still the 24th in Pacific time.
    const byInstant = getQueensDailyPuzzle(new Date("2026-11-24T18:00:00Z"));
    expect(byInstant.puzzle).toEqual(byDate.puzzle);
    expect(byDate.puzzle.id).toBe(queensPuzzleId(byDate.info.seed));
    expect(validateQueensPuzzle(byDate.puzzle).problems).toEqual([]);
    // 05:00 UTC on the 25th is 21:00 on the 24th in Pacific time.
    expect(getQueensDailyPuzzle(new Date("2026-11-25T05:00:00Z")).info.date).toBe("2026-11-24");
  });

  it("recognizes a daily seed and refuses a forged one", () => {
    const info = getQueensDailyInfo("2026-11-26");
    expect(queensDailyDateFromSpec(info.spec)).toBe("2026-11-26");
    expect(queensDailyDateFromSpec({ ...info.spec, difficulty: info.difficulty === "easy" ? "hard" : "easy" })).toBeNull();
    expect(queensDailyDateFromSpec({ ...info.spec, size: 8 })).toBeNull();
    expect(queensDailyDateFromSpec(queensSeeds.resolve({ seed: "lucky" }))).toBeNull();
  });

  it("two weeks of dailies are all valid and all different", () => {
    const ids = new Set<string>();
    for (let day = 0; day < 14; day++) {
      const { puzzle } = getQueensDailyPuzzle(addDays("2026-11-22", day));
      expect(validateQueensPuzzle(puzzle).problems, puzzle.seed).toEqual([]);
      ids.add(puzzle.id);
    }
    expect(ids.size).toBe(14);
  });
});
