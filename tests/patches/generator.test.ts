import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  GENERATOR_VERSION,
  TIER_CONFIG,
  createRng,
  evaluateDifficulty,
  generateFromSpec,
  generatePuzzle,
  hashHex,
  randomPartition,
  solveWithLogic,
  validatePuzzle,
  validateState,
} from "@/games/patches/engine";

/** Puzzles per tier in the bulk run. Raise with PATCHES_BULK=500 for a soak test. */
const BULK = Number(process.env.PATCHES_BULK ?? 75);

const fingerprint = (puzzle: ReturnType<typeof generatePuzzle>): string =>
  hashHex(JSON.stringify([puzzle.width, puzzle.height, puzzle.clues, puzzle.solution.map((region) => [region.clueId, region.width, region.height])]));

describe("seed determinism", () => {
  it("generates the identical puzzle for the same seed and difficulty", () => {
    expect(generatePuzzle("example-seed", "hard")).toEqual(generatePuzzle("example-seed", "hard"));
  });

  it("treats numeric and string seeds alike", () => {
    expect(generatePuzzle(12345, "medium")).toEqual(generatePuzzle("12345", "medium"));
  });

  it("changes with seed, difficulty and size", () => {
    const base = fingerprint(generatePuzzle("example-seed", "hard", { size: 7 }));
    expect(fingerprint(generatePuzzle("example-seed-2", "hard", { size: 7 }))).not.toBe(base);
    expect(fingerprint(generatePuzzle("example-seed", "medium", { size: 7 }))).not.toBe(base);
    expect(fingerprint(generatePuzzle("example-seed", "hard", { size: 8 }))).not.toBe(base);
  });

  it("pins a known puzzle so generator changes require a version bump", () => {
    const puzzle = generatePuzzle("example-seed", "hard");
    expect(puzzle.seed).toBe("PATCHES:example-seed:1:hard");
    expect(puzzle.version).toBe(GENERATOR_VERSION);
    expect(fingerprint(puzzle)).toMatchInlineSnapshot(`"0aaa6d84c0fd95a1dbe7d73081d4b57f"`);
  });

  it("rejects versions and sizes it cannot reproduce", () => {
    expect(() => generateFromSpec({ token: "x", version: 99, difficulty: "easy" })).toThrow(/version/i);
    expect(() => generateFromSpec({ token: "x", version: 1, difficulty: "easy", size: 3 })).toThrow(/size/i);
  });
});

describe("partition", () => {
  it("tiles the board exactly, without 1x1 patches", () => {
    for (let i = 0; i < 200; i++) {
      const size = 5 + (i % 6);
      const rects = randomPartition(createRng(`partition-${i}`), { width: size, height: size, meanArea: 4.5, areaSpread: 2.4 });
      const seen = new Uint8Array(size * size);
      for (const rect of rects) {
        expect(rect.width * rect.height).toBeGreaterThan(1);
        for (let r = rect.row; r < rect.row + rect.height; r++) {
          for (let c = rect.column; c < rect.column + rect.width; c++) {
            expect(r >= 0 && r < size && c >= 0 && c < size).toBe(true);
            seen[r * size + c]++;
          }
        }
      }
      expect([...seen].every((count) => count === 1)).toBe(true);
    }
  });
});

describe("bulk generation", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: ${BULK} puzzles are valid, unique, fair and in tier`, () => {
      const seen = new Set<string>();
      let inTier = 0;
      for (let i = 0; i < BULK; i++) {
        const puzzle = generatePuzzle(`bulk-${difficulty}-${i}`, difficulty);
        const audit = validatePuzzle(puzzle);
        expect(audit.problems, puzzle.seed).toEqual([]);
        expect(audit.solutionCount, puzzle.seed).toBe(1);
        expect(validateState(puzzle, puzzle.solution).complete, puzzle.seed).toBe(true);
        expect(puzzle.clues.length, puzzle.seed).toBe(puzzle.solution.length);
        expect(TIER_CONFIG[difficulty].sizes, puzzle.seed).toContain(puzzle.width);

        const logic = solveWithLogic(puzzle);
        expect(logic.solved, puzzle.seed).toBe(true);
        expect(logic.steps.filter((step) => step.technique === "search"), puzzle.seed).toHaveLength(0);

        const report = evaluateDifficulty(puzzle);
        expect(report.score, puzzle.seed).toBe(puzzle.metadata.difficultyScore);
        if (report.tier === difficulty) inTier++;
        seen.add(fingerprint(puzzle));
      }
      expect(inTier / BULK).toBeGreaterThanOrEqual(0.95);
      expect(seen.size).toBe(BULK);
    });
  }

  it("every supported board size works for every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let size = 5; size <= 10; size++) {
        for (let i = 0; i < 3; i++) {
          const puzzle = generatePuzzle(`size-${i}`, difficulty, { size });
          expect(puzzle.width).toBe(size);
          expect(puzzle.height).toBe(size);
          expect(validatePuzzle(puzzle).problems, puzzle.seed).toEqual([]);
        }
      }
    }
  });

  it("harder tiers score higher on average", () => {
    const mean = (difficulty: (typeof DIFFICULTIES)[number]) => {
      let total = 0;
      for (let i = 0; i < 30; i++) total += generatePuzzle(`order-${i}`, difficulty).metadata.difficultyScore;
      return total / 30;
    };
    const [easy, medium, hard, expert] = DIFFICULTIES.map(mean);
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
    expect(hard).toBeLessThan(expert);
  });

  it("keeps shape icons on every board", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 60; i++) {
        const puzzle = generatePuzzle(`icons-${i}`, difficulty);
        const shaped = puzzle.clues.filter((clue) => clue.shape === "square" || clue.shape === "tall" || clue.shape === "wide");
        expect(shaped.length, puzzle.seed).toBeGreaterThanOrEqual(2);
        for (const clue of shaped) {
          const region = puzzle.solution.find((entry) => entry.clueId === clue.id)!;
          expect(region.shape, puzzle.seed).toBe(clue.shape);
        }
      }
    }
  });

  it("does not hand out the whole board on the first look", () => {
    for (const difficulty of ["medium", "hard", "expert"] as const) {
      for (let i = 0; i < 30; i++) {
        const puzzle = generatePuzzle(`opening-${i}`, difficulty);
        expect(puzzle.metadata.metrics.forcedMoveCount, puzzle.seed).toBeLessThan(puzzle.clues.length);
      }
    }
  });
});
