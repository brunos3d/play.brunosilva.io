import { describe, expect, it } from "vitest";
import { createGame, formatSeed, generateFromSpec, generatePuzzle, normalizeToken, parseSeed, patchesSeeds, placeRegion, regionRect, removeRegionAt, resolveSpec, revealStep } from "@/games/patches/engine";
import { fromSnapshot, toSnapshot } from "@/games/patches/storage/progress";
import { zipSeeds } from "@/games/zip/engine";
import { buildPlayPath, buildPlayUrl, buildShareText, specFromSearchParams } from "@/shared/platform/share-text";

const puzzle = generatePuzzle("storage", "medium");
const RUNNING = { startedAt: 1_790_000_000_000, finishedMs: null };

function playSome(count: number) {
  let state = createGame(puzzle.id);
  for (const region of puzzle.solution.slice(0, count)) {
    const result = placeRegion(puzzle, state, regionRect(region));
    if (!result.ok) throw new Error("fixture placement failed");
    state = result.state;
  }
  return state;
}

const roundTrip = (snapshot: unknown) => fromSnapshot(puzzle, JSON.parse(JSON.stringify(snapshot)));

describe("patches snapshot", () => {
  it("round-trips an unfinished board with its running clock", () => {
    const state = removeRegionAt(playSome(3), puzzle.solution[0].cells[0]);
    const restored = roundTrip(toSnapshot(state, puzzle.seed, RUNNING));
    expect(restored?.state).toEqual(state);
    expect(restored?.clock).toEqual(RUNNING);
  });

  it("restores a solved board as solved, decided by the validator", () => {
    const state = playSome(puzzle.solution.length);
    expect(roundTrip(toSnapshot(state, puzzle.seed, { startedAt: 1, finishedMs: 48_000 }))?.state.status).toBe("solved");
  });

  it("refuses a forged solved flag, and a finished clock on an unfinished board", () => {
    const partial = toSnapshot(playSome(2), puzzle.seed, RUNNING);
    expect(roundTrip({ ...partial, status: "solved" })?.state.status).toBe("playing");
    expect(roundTrip({ ...partial, finishedMs: 1_000 })).toBeNull();
    expect(roundTrip(toSnapshot(playSome(puzzle.solution.length), puzzle.seed, RUNNING))).toBeNull();
  });

  it("remembers that a solution was being revealed", () => {
    const revealing = revealStep(puzzle.solution, playSome(1)).state;
    expect(roundTrip(toSnapshot(revealing, puzzle.seed, RUNNING))?.state.revealed).toBe(true);
  });

  it("drops snapshots that break the rules or belong to another puzzle", () => {
    const good = toSnapshot(playSome(2), puzzle.seed, RUNNING);
    expect(roundTrip({ ...good, regions: [good.regions[0], { ...good.regions[1], cells: good.regions[0].cells }] })).toBeNull();
    expect(roundTrip({ ...good, puzzleId: "other" })).toBeNull();
    expect(roundTrip({ ...good, snapshotVersion: 1 })).toBeNull();
    expect(roundTrip({ ...good, moves: -1 })).toBeNull();
    expect(fromSnapshot(puzzle, "garbage")).toBeNull();
    expect(fromSnapshot(puzzle, undefined)).toBeNull();
  });
});

describe("seeds and share URLs", () => {
  it("round-trips canonical seeds", () => {
    for (const spec of [
      { token: "2026-09-21", version: 1, difficulty: "hard" as const },
      { token: "lucky_7.x", version: 1, difficulty: "easy" as const, size: 10 },
    ]) {
      expect(parseSeed(formatSeed(spec))).toEqual(spec);
    }
    expect(formatSeed({ token: "2026-09-21", version: 1, difficulty: "hard" })).toBe("PATCHES:2026-09-21:1:hard");
  });

  it("rejects malformed seeds, including another game's", () => {
    for (const bad of ["", "hello", "PATCHES:x:1", "PATCHES:x:0:hard", "PATCHES:x:1:brutal", "PATCHES:x:1:hard:4", "PATCHES:x:1:hard:11", "PATCHES::1:hard", "ZIP:x:1:hard", "PATCHES:a b:1:hard"]) {
      expect(parseSeed(bad), bad).toBeNull();
    }
    expect(zipSeeds.parse("ZIP:x:1:hard:8")).toEqual({ token: "x", version: 1, difficulty: "hard", size: 8 });
    expect(zipSeeds.parse("ZIP:x:1:hard:9")).toBeNull();
    expect(zipSeeds.parse("PATCHES:x:1:hard")).toBeNull();
  });

  it("normalizes free text into a safe token", () => {
    expect(normalizeToken("  hello world  ")).toBe("hello-world");
    expect(normalizeToken("a:b/c?d")).toBe("abcd");
    expect(normalizeToken("")).toBe("0");
    expect(normalizeToken(12345)).toBe("12345");
    expect(normalizeToken("x".repeat(200))).toHaveLength(64);
  });

  it("a shared URL reproduces the exact puzzle", () => {
    const original = generatePuzzle("share me", "hard", { size: 8 });
    const url = new URL(buildPlayUrl("https://example.test/", "/patches", patchesSeeds, parseSeed(original.seed)!));
    expect(url.pathname).toBe("/patches/play");
    expect(url.searchParams.get("seed")).toBe("PATCHES:share-me:1:hard:8");
    expect(generateFromSpec(specFromSearchParams(patchesSeeds, url.searchParams)!)).toEqual(original);
  });

  it("accepts loose query parameters for hand-typed links", () => {
    const spec = specFromSearchParams(patchesSeeds, new URLSearchParams("seed=12345&difficulty=expert&size=9"))!;
    expect(spec).toEqual({ token: "12345", version: 1, difficulty: "expert", size: 9 });
    expect(specFromSearchParams(patchesSeeds, new URLSearchParams("seed=abc"))).toEqual({ token: "abc", version: 1, difficulty: "medium" });
    expect(resolveSpec({ seed: "abc", difficulty: "nope", size: "99" })).toEqual({ token: "abc", version: 1, difficulty: "medium" });
    expect(specFromSearchParams(patchesSeeds, new URLSearchParams("difficulty=hard"))).toBeNull();
    expect(buildPlayPath("/zip", zipSeeds, { token: "7", version: 2, difficulty: "easy" })).toBe("/zip/play?seed=ZIP%3A7%3A2%3Aeasy");
    // An old Zip link such as /hard/42 lands here: size 9 is out of Zip's range and is dropped, not fatal.
    expect(specFromSearchParams(zipSeeds, new URLSearchParams("seed=42&difficulty=hard&size=9"))).toEqual({ token: "42", version: 2, difficulty: "hard" });
    // A link made with the first generator says so, and keeps its board.
    expect(specFromSearchParams(zipSeeds, new URLSearchParams("seed=ZIP%3A42%3A1%3Ahard"))).toEqual({ token: "42", version: 1, difficulty: "hard" });
  });

  it("formats the result text the same way for every game", () => {
    expect(buildShareText({ gameName: "Zip", dailyNumber: 553, difficulty: "easy", size: 6, elapsedMs: 48_200, hintsUsed: 0, mistakesLabel: "Backtracks", mistakes: 1, streak: 12 })).toBe(
      "Zip #553\n00:48\nHints: 0\nBacktracks: 1\nStreak: 12",
    );
    expect(buildShareText({ gameName: "Patches", difficulty: "hard", size: 8, elapsedMs: 125_000, hintsUsed: 2, mistakesLabel: "Redraws", mistakes: 0, streak: 4 })).toBe(
      "Patches Hard 8x8\n02:05\nHints: 2\nRedraws: 0",
    );
  });
});
