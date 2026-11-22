import { describe, expect, it } from "vitest";
import { buildTopology, checkQueen, generateQueensPuzzle, ruleBetween, ruledOutCells, unitsOf, validateQueens, validateShape } from "@/games/queens/engine";
import { COLUMNS, CONFINED_REGION, shape } from "./fixtures";

const topology = buildTopology(CONFINED_REGION);
const at = (row: number, column: number) => row * 5 + column;

describe("queens rules", () => {
  it("names the rule two queens break", () => {
    expect(ruleBetween(topology, at(0, 0), at(0, 4))).toBe("same-row");
    expect(ruleBetween(topology, at(0, 3), at(4, 3))).toBe("same-column");
    expect(ruleBetween(topology, at(1, 0), at(3, 2))).toBe("same-region");
    expect(ruleBetween(topology, at(0, 2), at(1, 3))).toBe("touching");
    // A shared diagonal is fine as long as the queens do not touch.
    expect(ruleBetween(topology, at(0, 0), at(2, 3))).toBeNull();
    expect(ruleBetween(topology, at(0, 0), at(3, 3))).toBeNull();
  });

  it("refuses a queen with the rule and the queen it clashes with", () => {
    expect(checkQueen(topology, [], at(2, 2))).toBeNull();
    expect(checkQueen(topology, [at(0, 0)], at(2, 3))).toBeNull();
    const error = checkQueen(topology, [at(0, 0), at(1, 2)], at(2, 3));
    expect(error).toMatchObject({ rule: "touching", with: at(1, 2) });
    expect(error?.message).toMatch(/touch/);
    expect(checkQueen(topology, [at(0, 0)], at(0, 3))?.message).toMatch(/row/);
    expect(checkQueen(topology, [at(0, 0)], at(4, 0))?.message).toMatch(/column/);
    expect(checkQueen(topology, [at(1, 0)], at(3, 2))?.message).toMatch(/region/);
  });

  it("accepts only a full board with one queen per row, column and region and none touching", () => {
    const puzzle = generateQueensPuzzle("rules", "medium", { size: 6 });
    const board = buildTopology(puzzle);
    expect(validateQueens(board, puzzle.solution)).toEqual({ complete: true, conflicts: [] });
    expect(validateQueens(board, puzzle.solution.slice(1)).complete).toBe(false);
    expect(validateQueens(board, [...puzzle.solution.slice(1), puzzle.solution[1]]).complete).toBe(false);
    const moved = [puzzle.solution[0] === 0 ? 1 : 0, ...puzzle.solution.slice(1)];
    const check = validateQueens(board, moved);
    expect(check.complete).toBe(false);
    expect(check.conflicts.length).toBeGreaterThan(0);
    expect(validateQueens(board, [999]).complete).toBe(false);
  });

  it("derives the cells a queen rules out: its row, column, region and neighbours", () => {
    const out = ruledOutCells(topology, [at(0, 0)]);
    for (const cell of [at(0, 1), at(0, 4), at(4, 0), at(1, 1), at(0, 2)]) expect(out.has(cell)).toBe(true);
    expect(out.has(at(0, 0))).toBe(false);
    expect(out.has(at(2, 2))).toBe(false);
    expect(out.size).toBe(4 + 4 + 1);
    expect(ruledOutCells(topology, []).size).toBe(0);
  });

  it("lists a cell's region, row and column as units", () => {
    const [region, row, column] = unitsOf(topology, at(2, 3));
    expect(topology.units[region]).toMatchObject({ kind: "region", index: 3 });
    expect(topology.units[row]).toMatchObject({ kind: "row", index: 2 });
    expect(topology.units[column]).toMatchObject({ kind: "column", index: 3 });
  });

  it("audits the shape of a board", () => {
    expect(validateShape(CONFINED_REGION)).toEqual([]);
    expect(validateShape(COLUMNS)).toEqual([]);
    expect(validateShape({ size: 5, regions: [0, 1] })[0]).toMatch(/25 cells/);
    expect(validateShape(shape("00111", "22211", "22233", "44233", "44400")).join(" ")).toMatch(/not connected/);
    expect(validateShape(shape("00011", "00011", "00011", "22211", "22211")).join(" ")).toMatch(/5 regions/);
  });
});
