import { describe, expect, it } from "vitest";
import { EMPTY, MARK, QUEEN, buildTopology, defaultUnitName, generateQueensPuzzle, getQueensHint, queensOf, ruledOutCells } from "@/games/queens/engine";
import { CONFINED_REGION } from "./fixtures";

const puzzle = generateQueensPuzzle("hints", "hard", { size: 8 });
const topology = buildTopology(puzzle);
const empty = () => new Array<number>(64).fill(EMPTY);

describe("queens hints", () => {
  it("takes a wrong queen off before anything else", () => {
    const marks = empty();
    const wrong = marks.findIndex((_, cell) => !puzzle.solution.includes(cell));
    marks[wrong] = QUEEN;
    marks[puzzle.solution[7]] = MARK;
    const hint = getQueensHint(topology, puzzle.solution, marks);
    expect(hint).toMatchObject({ kind: "wrong-queen", cell: wrong });
    expect(hint.message).toMatch(/wrong place/);
  });

  it("takes off an X that covers a solution cell", () => {
    const marks = empty();
    marks[puzzle.solution[3]] = MARK;
    expect(getQueensHint(topology, puzzle.solution, marks)).toMatchObject({ kind: "wrong-mark", cell: puzzle.solution[3] });
  });

  it("says so when the board is complete", () => {
    const marks = empty();
    for (const cell of puzzle.solution) marks[cell] = QUEEN;
    expect(getQueensHint(topology, puzzle.solution, marks).kind).toBe("complete");
  });

  it("explains a step with the names it is given", () => {
    const board = buildTopology(CONFINED_REGION);
    const solution = [0, 0, 0, 0, 0]; // not consulted: the board is empty, so there is no mistake to find
    const plain = getQueensHint(board, solution, new Array<number>(25).fill(EMPTY));
    expect(plain).toMatchObject({ kind: "eliminate", technique: "confined-region", cells: [3, 4] });
    expect(plain.message).toBe("Every free cell of region 1 is in row 1, so its queen takes that row. No other cell there can hold one.");
    if (plain.kind === "eliminate") expect(plain.highlight).toEqual([0, 1, 2]);
    const named = getQueensHint(board, solution, new Array<number>(25).fill(EMPTY), (unit) => (unit.kind === "region" ? "the rose region" : defaultUnitName(unit)));
    expect(named.message).toContain("the rose region");
  });

  it("solves any board when followed to the end, without a single guess", () => {
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      for (let i = 0; i < 6; i++) {
        const board = generateQueensPuzzle(`follow-${i}`, difficulty);
        const boardTopology = buildTopology(board);
        const solution = new Set(board.solution);
        const marks = new Array<number>(board.size * board.size).fill(EMPTY);
        let steps = 0;
        for (; steps < 400; steps++) {
          const hint = getQueensHint(boardTopology, board.solution, marks);
          if (hint.kind === "complete") break;
          expect(hint.message.length).toBeGreaterThan(10);
          if (hint.kind === "place") {
            expect(solution.has(hint.cell), `${board.seed} step ${steps}`).toBe(true);
            expect(hint.technique).toBe("single");
            marks[hint.cell] = QUEEN;
          } else if (hint.kind === "eliminate") {
            expect(hint.cells.length).toBeGreaterThan(0);
            const ruledOut = ruledOutCells(boardTopology, queensOf(marks));
            for (const cell of hint.cells) {
              expect(solution.has(cell), `${board.seed} step ${steps}`).toBe(false);
              // A hint never repeats what the board already shows.
              expect(marks[cell]).toBe(EMPTY);
              expect(ruledOut.has(cell)).toBe(false);
              marks[cell] = MARK;
            }
          } else {
            throw new Error(`unexpected ${hint.kind} on a board without mistakes`);
          }
        }
        expect(queensOf(marks)).toEqual(board.solution);
        expect(steps).toBe(board.metadata.steps);
      }
    }
  });

  it("uses what the player already worked out", () => {
    const marks = empty();
    for (const cell of puzzle.solution.slice(0, 7)) marks[cell] = QUEEN;
    const hint = getQueensHint(topology, puzzle.solution, marks);
    expect(hint).toMatchObject({ kind: "place", cell: puzzle.solution[7], technique: "single" });
  });
});
