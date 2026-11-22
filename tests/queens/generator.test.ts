import { describe, expect, it } from "vitest";
import { DIFFICULTIES, QUEENS_GENERATOR_VERSION, QUEENS_TIERS, buildTopology, deduce, generateQueensFromSpec, generateQueensPuzzle, queensPuzzleId, queensSeeds, validateQueensPuzzle, validateShape } from "@/games/queens/engine";
import { hashHex } from "@/shared/engine/prng";

const BULK = Number(process.env.QUEENS_BULK ?? 30);
const fingerprint = (puzzle: { regions: number[]; solution: number[] }) => hashHex(`${puzzle.regions.join(",")}|${puzzle.solution.join(",")}`);

describe("queens generator", () => {
  it("is a pure function of the seed, the difficulty and the size", () => {
    const first = generateQueensPuzzle("example-seed", "hard");
    const second = generateQueensPuzzle("example-seed", "hard");
    expect(second).toEqual(first);
    expect(generateQueensPuzzle("example-seed", "expert").regions).not.toEqual(first.regions);
    expect(generateQueensPuzzle("another-seed", "hard").regions).not.toEqual(first.regions);
    expect(generateQueensPuzzle("example-seed", "hard", { size: 8 }).size).toBe(8);
  });

  it("keeps building the same board for a known seed", () => {
    // A change here means old links and old dailies would open a different board: bump QUEENS_GENERATOR_VERSION instead.
    const puzzle = generateQueensPuzzle("example-seed", "hard");
    expect(puzzle.seed).toBe("QUEENS:example-seed:1:hard");
    expect(puzzle.id).toBe("queens-8262c805a1bb");
    expect(puzzle.size).toBe(9);
    expect(fingerprint(puzzle)).toBe("e28ebefe8edbb869ebd6f30257b7880b");
  });

  it("derives the id from the canonical seed alone", () => {
    const puzzle = generateQueensPuzzle("hello world", "easy");
    expect(puzzle.seed).toBe("QUEENS:hello-world:1:easy");
    expect(queensPuzzleId(puzzle.seed)).toBe(puzzle.id);
    expect(puzzle.version).toBe(QUEENS_GENERATOR_VERSION);
  });

  it("rejects versions and sizes it cannot build", () => {
    expect(() => generateQueensFromSpec({ token: "x", version: 9, difficulty: "easy" })).toThrow(/version 9/);
    expect(() => generateQueensFromSpec({ token: "x", version: 1, difficulty: "easy", size: 11 })).toThrow(/size 11/);
    expect(queensSeeds.parse("QUEENS:x:1:easy:4")).toBeNull();
    expect(queensSeeds.parse("ZIP:x:1:easy")).toBeNull();
  });

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: ${BULK} puzzles have one solution, fall to deduction and fit the tier`, () => {
      const tier = QUEENS_TIERS[difficulty];
      const seen = new Set<string>();
      let withinLevel = 0;
      for (let i = 0; i < BULK; i++) {
        const puzzle = generateQueensPuzzle(`bulk-${i}`, difficulty);
        expect(validateQueensPuzzle(puzzle).problems, puzzle.seed).toEqual([]);
        expect(tier.sizes).toContain(puzzle.size);
        expect(new Set(puzzle.regions).size).toBe(puzzle.size);
        expect(puzzle.metadata.regionSizes.reduce((sum, count) => sum + count, 0)).toBe(puzzle.size * puzzle.size);
        if (puzzle.size >= 7) expect(Math.min(...puzzle.metadata.regionSizes)).toBeGreaterThanOrEqual(tier.minRegionSize);
        if (puzzle.metadata.maxLevel <= tier.maxLevel) withinLevel++;
        seen.add(fingerprint(puzzle));
      }
      expect(seen.size).toBe(BULK);
      // The level cap is a preference, not a guarantee, but almost every board should meet it.
      expect(withinLevel).toBeGreaterThanOrEqual(Math.floor(BULK * 0.9));
    });
  }

  it("builds every size for every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let size = queensSeeds.minSize; size <= queensSeeds.maxSize; size++) {
        const puzzle = generateQueensPuzzle(`sizes-${size}`, difficulty, { size });
        expect(puzzle.size).toBe(size);
        expect(validateQueensPuzzle(puzzle).problems, puzzle.seed).toEqual([]);
      }
    }
  });

  it("makes harder tiers need harder deductions", () => {
    const average = (difficulty: (typeof DIFFICULTIES)[number]) => {
      let total = 0;
      for (let i = 0; i < 15; i++) total += generateQueensPuzzle(`ladder-${i}`, difficulty, { size: 8 }).metadata.score;
      return total / 15;
    };
    const scores = DIFFICULTIES.map(average);
    expect(scores[0]).toBeLessThan(scores[1]);
    expect(scores[1]).toBeLessThan(scores[2]);
    expect(scores[2]).toBeLessThan(scores[3]);
  });

  it("stores the deduction profile it measured", () => {
    const puzzle = generateQueensPuzzle("profile", "hard");
    const deduction = deduce(buildTopology(puzzle));
    expect(puzzle.metadata).toMatchObject({ steps: deduction.steps.length, maxLevel: deduction.maxLevel, score: deduction.score, levels: deduction.levels });
    expect(validateShape(puzzle)).toEqual([]);
  });

  it("notices a puzzle that was tampered with", () => {
    const puzzle = generateQueensPuzzle("tamper", "medium");
    const merged = { ...puzzle, regions: puzzle.regions.map((region) => (region === 1 ? 0 : region)) };
    expect(validateQueensPuzzle(merged).ok).toBe(false);
    const moved = { ...puzzle, solution: [puzzle.solution[0] === 0 ? 1 : 0, ...puzzle.solution.slice(1)] };
    expect(validateQueensPuzzle(moved).ok).toBe(false);
  });
});
