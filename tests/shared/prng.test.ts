import { describe, expect, it } from "vitest";
import { createRng, hashHex, hashString } from "@/shared/engine/prng";

describe("prng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng("example-seed");
    const b = createRng("example-seed");
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it("treats numeric and string seeds with the same text as equal", () => {
    expect(createRng(12345).next()).toBe(createRng("12345").next());
  });

  it("diverges for different seeds", () => {
    const a = createRng("seed-a");
    const b = createRng("seed-b");
    const same = Array.from({ length: 50 }, () => a.next() === b.next());
    expect(same.filter(Boolean).length).toBeLessThan(3);
  });

  it("pins the sequence so engine upgrades cannot change it silently", () => {
    const rng = createRng("PATCHES:2026-09-21:1:hard");
    const sample = Array.from({ length: 4 }, () => rng.int(1_000_000));
    expect(sample).toMatchInlineSnapshot(`
      [
        331460,
        147169,
        424967,
        661896,
      ]
    `);
  });

  it("stays inside [0, 1) and is roughly uniform", () => {
    const rng = createRng("uniformity");
    const buckets = new Array(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      buckets[Math.floor(value * 10)]++;
    }
    for (const count of buckets) {
      expect(Math.abs(count - draws / 10)).toBeLessThan(draws * 0.01);
    }
  });

  it("range is inclusive on both ends", () => {
    const rng = createRng("range");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.range(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("weighted never picks a zero-weight item", () => {
    const rng = createRng("weights");
    for (let i = 0; i < 500; i++) {
      expect(rng.weighted(["a", "b", "c"], [0, 1, 0])).toBe("b");
    }
    expect(() => rng.weighted(["a"], [0])).toThrow();
  });

  it("shuffle keeps every element and does not mutate the input", () => {
    const rng = createRng("shuffle");
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...output].sort((x, y) => x - y)).toEqual(input);
  });

  it("hashes are stable and sensitive to every character", () => {
    expect(hashString("abc")).toEqual(hashString("abc"));
    expect(hashHex("abc")).not.toBe(hashHex("abd"));
    expect(hashHex("abc")).toHaveLength(32);
  });
});
