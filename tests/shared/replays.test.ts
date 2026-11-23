import { beforeEach, describe, expect, it } from "vitest";
import { isReplay, markReplay } from "@/shared/storage/replays";

function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) },
  });
  return store;
}

describe("replays", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installStorage();
  });

  it("remembers a replayed puzzle per game and per seed", () => {
    expect(isReplay("zip", "ZIP:lucky:2:hard:8")).toBe(false);
    markReplay("zip", "ZIP:lucky:2:hard:8");
    expect(isReplay("zip", "ZIP:lucky:2:hard:8")).toBe(true);
    expect(isReplay("zip", "ZIP:other:2:hard:8")).toBe(false);
    expect(isReplay("patches", "ZIP:lucky:2:hard:8")).toBe(false);
  });

  it("keeps one entry per puzzle and drops the oldest past its limit", () => {
    markReplay("zip", "first");
    for (let index = 0; index < 300; index++) markReplay("zip", `seed-${index}`);
    markReplay("zip", "seed-299");
    const list = JSON.parse(store.get("minigames:replays:v1") ?? "[]") as string[];
    expect(list).toHaveLength(300);
    expect(new Set(list).size).toBe(300);
    expect(isReplay("zip", "first")).toBe(false);
    expect(isReplay("zip", "seed-299")).toBe(true);
  });

  it("treats broken stored data as an empty list", () => {
    store.set("minigames:replays:v1", "{not json");
    expect(isReplay("zip", "x")).toBe(false);
    store.set("minigames:replays:v1", JSON.stringify({ zip: true }));
    expect(isReplay("zip", "x")).toBe(false);
    markReplay("zip", "x");
    expect(isReplay("zip", "x")).toBe(true);
  });
});
