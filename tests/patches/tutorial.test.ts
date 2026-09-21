import { describe, expect, it } from "vitest";
import { solve, solveWithLogic } from "@/games/patches/engine";
import { TUTORIAL_PUZZLE } from "@/games/patches/components/tutorial/tutorial-puzzle";

describe("tutorial board", () => {
  it("has exactly one solution, found by the same solver as every other puzzle", () => {
    const result = solve(TUTORIAL_PUZZLE, { maxSolutions: 10 });
    expect(result.solutionCount).toBe(1);
    expect(result.solutions[0]).toEqual([
      { row: 0, column: 0, width: 2, height: 2 },
      { row: 0, column: 2, width: 2, height: 3 },
      { row: 2, column: 0, width: 2, height: 1 },
      { row: 3, column: 0, width: 4, height: 1 },
    ]);
  });

  it("can be solved by logic alone, in the order the steps teach", () => {
    const logic = solveWithLogic(TUTORIAL_PUZZLE);
    expect(logic.solved).toBe(true);
    expect(logic.steps.every((step) => step.technique !== "search")).toBe(true);
  });
});
