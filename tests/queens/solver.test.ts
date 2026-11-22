import { describe, expect, it } from "vitest";
import { LEVEL_WEIGHTS, MAX_LEVEL, applyStep, buildTopology, createKnowledge, deduce, generateQueensPuzzle, isContradiction, nextStep, placeQueen, solveQueens } from "@/games/queens/engine";
import { COLUMNS, CONFINED_LINE, CONFINED_REGION, REGION_GROUP } from "./fixtures";

const at = (row: number, column: number) => row * 5 + column;

describe("queens search solver", () => {
  it("finds the one solution of a generated board", () => {
    const puzzle = generateQueensPuzzle("search", "hard", { size: 8 });
    const result = solveQueens(puzzle, { maxSolutions: 5 });
    expect(result.solutionCount).toBe(1);
    expect(result.solutions[0]).toEqual(puzzle.solution);
    expect(result.exhausted).toBe(true);
  });

  it("counts several solutions when the regions do not pin one down", () => {
    expect(solveQueens(COLUMNS, { maxSolutions: 100 }).solutionCount).toBe(14);
    expect(solveQueens(COLUMNS, { maxSolutions: 2 }).solutionCount).toBe(2);
    expect(solveQueens({ size: 5, regions: new Array<number>(25).fill(0) }).solutionCount).toBe(0);
  });

  it("stops on a node budget, the same way every time", () => {
    const first = solveQueens(COLUMNS, { maxSolutions: 100, maxNodes: 20 });
    const second = solveQueens(COLUMNS, { maxSolutions: 100, maxNodes: 20 });
    expect(first.exhausted).toBe(false);
    expect(first).toEqual(second);
  });
});

describe("queens deduction solver", () => {
  it("places a queen in a group with one free cell", () => {
    const puzzle = generateQueensPuzzle("tutorial-1", "easy", { size: 5, version: 1 });
    const topology = buildTopology(puzzle);
    const step = nextStep(topology, createKnowledge(topology));
    expect(step).toMatchObject({ technique: "single", level: 1 });
    expect(puzzle.solution).toContain(step!.place);
  });

  it("clears the rest of a line when a region is confined to it", () => {
    const topology = buildTopology(CONFINED_REGION);
    const step = nextStep(topology, createKnowledge(topology));
    expect(step).toMatchObject({ technique: "confined-region", level: 2, place: null, eliminate: [at(0, 3), at(0, 4)] });
    expect(topology.units[step!.units[0]]).toMatchObject({ kind: "region", index: 0 });
    expect(topology.units[step!.lines[0]]).toMatchObject({ kind: "row", index: 0 });
  });

  it("clears the rest of a region when a line is confined to it", () => {
    const topology = buildTopology(CONFINED_LINE);
    const step = nextStep(topology, createKnowledge(topology));
    expect(step).toMatchObject({ technique: "confined-line", level: 2, eliminate: [at(0, 1)] });
    expect(topology.units[step!.lines[0]]).toMatchObject({ kind: "column", index: 0 });
  });

  it("rules out a cell whose queen would starve a group", () => {
    const topology = buildTopology(CONFINED_REGION);
    const knowledge = createKnowledge(topology);
    const techniques: string[] = [];
    for (let i = 0; i < 3; i++) {
      const step = nextStep(topology, knowledge)!;
      techniques.push(step.technique);
      applyStep(topology, knowledge, step);
      // Region 1 is down to two cells in the same column pair, and both cells next to them go.
      if (step.technique === "blocker") expect(step.eliminate).toEqual([at(2, 3), at(2, 4)]);
    }
    expect(techniques).toEqual(["confined-region", "confined-region", "blocker"]);
  });

  it("gives two regions that fit in two rows both queens of those rows", () => {
    const topology = buildTopology(REGION_GROUP);
    const steps = deduce(topology).steps;
    const group = steps.find((step) => step.technique === "region-group");
    expect(group).toMatchObject({ level: 4, eliminate: [at(0, 4), at(1, 4)] });
    expect(group!.units.map((unit) => topology.units[unit].index)).toEqual([0, 1]);
    expect(group!.lines.map((line) => topology.units[line].index)).toEqual([0, 1]);
  });

  it("applies queen kill when a queen is placed, and notices a contradiction", () => {
    const topology = buildTopology(CONFINED_REGION);
    const knowledge = createKnowledge(topology);
    placeQueen(topology, knowledge, at(0, 0));
    expect(knowledge.free[at(1, 1)]).toBe(0);
    expect(knowledge.free[at(0, 2)]).toBe(0);
    expect(knowledge.free[at(4, 0)]).toBe(0);
    expect(knowledge.free[at(2, 2)]).toBe(1);
    expect(isContradiction(topology, knowledge)).toBe(false);
    // Region 1 with every cell crossed out can never get its queen.
    const blocked = createKnowledge(topology, [], [at(0, 3), at(0, 4), at(1, 3), at(1, 4)]);
    expect(isContradiction(topology, blocked)).toBe(true);
    expect(nextStep(topology, blocked)).toBeNull();
  });

  it("never guesses: every step is true of the one solution", () => {
    const seen = new Set<string>();
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      for (let i = 0; i < 12; i++) {
        const puzzle = generateQueensPuzzle(`sound-${i}`, difficulty);
        const solution = new Set(puzzle.solution);
        const result = deduce(buildTopology(puzzle));
        expect(result.solved).toBe(true);
        expect([...result.queens].sort((a, b) => a - b)).toEqual(puzzle.solution);
        for (const step of result.steps) {
          seen.add(step.technique);
          if (step.place !== null) expect(solution.has(step.place)).toBe(true);
          for (const cell of step.eliminate) expect(solution.has(cell)).toBe(false);
          expect(step.level).toBeGreaterThanOrEqual(1);
          expect(step.level).toBeLessThanOrEqual(MAX_LEVEL);
        }
        expect(result.score).toBe(result.levels.reduce((sum, count, level) => sum + count * LEVEL_WEIGHTS[level], 0));
        expect(Math.max(...result.steps.map((step) => step.level))).toBe(result.maxLevel);
      }
    }
    for (const technique of ["single", "confined-region", "confined-line", "blocker", "region-group"]) expect(seen, technique).toContain(technique);
  });

  it("carries on from a board the player has already worked on", () => {
    const puzzle = generateQueensPuzzle("resume", "hard", { size: 8 });
    const topology = buildTopology(puzzle);
    const wrong = Array.from({ length: 64 }, (_, cell) => cell).filter((cell) => !puzzle.solution.includes(cell)).slice(0, 20);
    const result = deduce(topology, createKnowledge(topology, puzzle.solution.slice(0, 3), wrong));
    expect(result.solved).toBe(true);
    expect(result.queens).toHaveLength(8);
  });
});
