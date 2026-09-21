import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { computeStreak } from "@/shared/engine/streak";
import { resetIdbConnection } from "@/shared/storage/idb";
import { type DailyResult, loadBoard, loadDailyResult, loadDailyResults, recordBestTime, saveBoard, saveDailyResult, streakDates } from "@/shared/storage/progress";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/shared/storage/settings";

const result = (overrides: Partial<DailyResult>): DailyResult => ({
  game: "zip",
  date: "2026-09-21",
  number: 553,
  difficulty: "easy",
  seed: "ZIP:2026-09-21:1:easy",
  elapsedMs: 50_000,
  hintsUsed: 1,
  mistakes: 2,
  moves: 8,
  revealed: false,
  ...overrides,
});

describe("platform storage", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetIdbConnection();
  });

  it("keeps boards of different games apart, even under the same puzzle id", async () => {
    await saveBoard("zip", "same-id", { game: "zip" });
    await saveBoard("patches", "same-id", { game: "patches" });
    expect(await loadBoard("zip", "same-id")).toEqual({ game: "zip" });
    expect(await loadBoard("patches", "same-id")).toEqual({ game: "patches" });
    expect(await loadBoard("zip", "other")).toBeUndefined();
  });

  it("keeps the first daily result of a date, per game", async () => {
    await saveDailyResult(result({}));
    const kept = await saveDailyResult(result({ elapsedMs: 5_000, hintsUsed: 0 }));
    expect(kept.elapsedMs).toBe(50_000);
    await saveDailyResult(result({ game: "patches", seed: "PATCHES:2026-09-21:1:easy", number: 188 }));
    expect(await loadDailyResults("zip")).toHaveLength(1);
    expect((await loadDailyResult("patches", "2026-09-21"))?.number).toBe(188);
  });

  it("a revealed day is stored but earns no streak", async () => {
    await saveDailyResult(result({ date: "2026-09-19" }));
    await saveDailyResult(result({ date: "2026-09-20", revealed: true }));
    await saveDailyResult(result({ date: "2026-09-21" }));
    const dates = streakDates(await loadDailyResults("zip"));
    expect(dates.sort()).toEqual(["2026-09-19", "2026-09-21"]);
    expect(computeStreak(dates, "2026-09-21").current).toBe(1);
  });

  it("tracks the best time per game, difficulty and size", async () => {
    expect((await recordBestTime("zip", "hard", 7, 90_000, "a")).isNew).toBe(true);
    expect((await recordBestTime("zip", "hard", 7, 95_000, "b")).isNew).toBe(false);
    expect(await recordBestTime("zip", "hard", 7, 60_000, "c")).toMatchObject({ isNew: true, best: { elapsedMs: 60_000, seed: "c" } });
    expect((await recordBestTime("patches", "hard", 7, 95_000, "d")).isNew).toBe(true);
    expect((await recordBestTime("zip", "hard", 8, 95_000, "e")).isNew).toBe(true);
  });
});

describe("settings", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear(), key: () => null, length: 0 } as Storage;
  });

  it("turns sound on by default", () => {
    expect(loadSettings()).toEqual({ sound: true, haptics: true, tutorials: {} });
    expect(DEFAULT_SETTINGS.sound).toBe(true);
  });

  it("remembers tutorials per game and ignores junk", () => {
    saveSettings({ sound: false, haptics: true, tutorials: { zip: true } });
    expect(loadSettings()).toEqual({ sound: false, haptics: true, tutorials: { zip: true } });
    store.set("minigames:settings:v1", JSON.stringify({ sound: "loud", tutorials: { patches: "yes", zip: true } }));
    expect(loadSettings()).toEqual({ sound: true, haptics: true, tutorials: { zip: true } });
    store.set("minigames:settings:v1", "{broken");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
