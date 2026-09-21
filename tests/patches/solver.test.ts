import { describe, expect, it } from "vitest";
import { buildCandidates, countSolutions, evaluateDifficulty, solve, solveWithLogic } from "@/games/patches/engine";
import { QUADRANT_RECTS, REAL_188, REAL_188_SOLUTION, quadrants } from "./fixtures";

describe("candidates", () => {
  it("never includes a rectangle with a second clue", () => {
    const set = buildCandidates(REAL_188);
    for (const candidate of set.candidates) {
      const inside = REAL_188.clues.filter(
        (clue) =>
          clue.row >= candidate.rect.row &&
          clue.row < candidate.rect.row + candidate.rect.height &&
          clue.column >= candidate.rect.column &&
          clue.column < candidate.rect.column + candidate.rect.width,
      );
      expect(inside).toHaveLength(1);
      expect(inside[0]).toBe(REAL_188.clues[candidate.clueIndex]);
    }
  });

  it("respects numbers and shapes", () => {
    const set = buildCandidates(quadrants());
    expect(set.byClue.map((list) => list.length)).toEqual([1, 1, 1, 1]);
  });
});

describe("search", () => {
  it("solves a real LinkedIn puzzle and finds it unique", () => {
    const result = solve(REAL_188, { maxSolutions: 10 });
    expect(result.solutionCount).toBe(1);
    expect(result.unique).toBe(true);
    expect(result.solutions[0]).toEqual(REAL_188_SOLUTION);
  });

  it("counts multiple solutions", () => {
    // Two clues on a 2x2 board, no information: split left/right or top/bottom.
    const puzzle = { width: 2, height: 2, clues: [{ id: "a", row: 0, column: 0 }, { id: "b", row: 1, column: 1 }] };
    expect(countSolutions(puzzle, 10)).toBe(2);
    expect(solve(puzzle).unique).toBe(false);
  });

  it("reports zero solutions for an impossible board", () => {
    const puzzle = { width: 2, height: 2, clues: [{ id: "a", row: 0, column: 0, area: 3 }] };
    expect(solve(puzzle).solutionCount).toBe(0);
    const tooSmall = { width: 3, height: 3, clues: [{ id: "a", row: 0, column: 0, area: 4 }, { id: "b", row: 2, column: 2, area: 4 }] };
    expect(solve(tooSmall).solutionCount).toBe(0);
  });

  it("honours fixed placements", () => {
    const loose = quadrants({ a: { area: undefined, shape: undefined }, b: { area: undefined, shape: undefined } });
    const good = solve(loose, { fixed: [{ clueIndex: 0, rect: QUADRANT_RECTS.a }], maxSolutions: 10 });
    expect(good.solutionCount).toBeGreaterThan(0);
    const blocked = solve(quadrants(), { fixed: [{ clueIndex: 0, rect: { row: 0, column: 0, width: 1, height: 1 } }] });
    expect(blocked.solutionCount).toBe(0);
  });

  it("stops at the node limit and says so", () => {
    const open = { width: 8, height: 8, clues: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, row: i, column: i })) };
    const result = solve(open, { maxSolutions: 1_000_000, maxNodes: 50 });
    expect(result.aborted).toBe(true);
    expect(result.unique).toBe(false);
  });
});

describe("logic solver", () => {
  it("solves the real puzzle without guessing", () => {
    const result = solveWithLogic(REAL_188);
    expect(result.solved).toBe(true);
    expect(result.contradiction).toBe(false);
    expect(result.steps).toHaveLength(6);
    expect(result.steps.some((step) => step.technique === "search")).toBe(false);
    expect(result.steps.filter((step) => step.wave === 1).length).toBeGreaterThan(0);
  });

  it("detects a contradiction from a wrong fixed patch", () => {
    const result = solveWithLogic(REAL_188, { fixed: [{ clueIndex: 1, rect: { row: 1, column: 0, width: 2, height: 1 } }] });
    expect(result.solved).toBe(false);
    expect(result.contradiction).toBe(true);
  });

  it("can stop after one step", () => {
    expect(solveWithLogic(REAL_188, { maxSteps: 1 }).steps).toHaveLength(1);
  });
});

describe("difficulty", () => {
  it("rates a fully labelled tiny board as easy", () => {
    const report = evaluateDifficulty(quadrants());
    expect(report.tier).toBe("easy");
    expect(report.metrics.solutionCount).toBe(1);
    expect(report.metrics.forcedMoveCount).toBe(4);
  });

  it("scores less information as harder on the same layout", () => {
    const labelled = { ...REAL_188, clues: REAL_188.clues.map((clue, i) => ({ ...clue, area: REAL_188_SOLUTION[i].width * REAL_188_SOLUTION[i].height })) };
    expect(evaluateDifficulty(REAL_188).score).toBeGreaterThan(evaluateDifficulty(labelled).score);
  });

  it("reports the documented metrics", () => {
    const { metrics, breakdown } = evaluateDifficulty(REAL_188);
    expect(metrics.unknownClueRatio).toBe(0.5);
    expect(metrics.clueDensity).toBeCloseTo(6 / 36, 3);
    expect(metrics.candidateCount).toBe(50);
    expect(metrics.guessCount).toBe(0);
    expect(Object.keys(breakdown).sort()).toEqual(["ambiguity", "depth", "guessing", "opening", "size", "technique", "unknowns"]);
  });
});
