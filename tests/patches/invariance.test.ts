import { describe, expect, it } from "vitest";
import { createRng, evaluateDifficulty, generatePuzzle } from "@/games/patches/engine";

describe("difficulty is a property of the puzzle, not of its listing", () => {
  it("gives the same score when clues are listed in a different order", () => {
    for (const difficulty of ["medium", "hard", "expert"] as const) {
      for (let i = 0; i < 15; i++) {
        const puzzle = generatePuzzle(`invariance-${i}`, difficulty);
        const baseline = evaluateDifficulty(puzzle);
        const rng = createRng(`shuffle-${i}`);
        for (let round = 0; round < 3; round++) {
          const shuffled = { ...puzzle, clues: rng.shuffle(puzzle.clues) };
          const report = evaluateDifficulty(shuffled);
          expect(report.score, puzzle.seed).toBe(baseline.score);
          expect(report.metrics.deductionDepth, puzzle.seed).toBe(baseline.metrics.deductionDepth);
        }
      }
    }
  });
});
