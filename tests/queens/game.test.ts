import { describe, expect, it } from "vitest";
import {
  EMPTY,
  MARK,
  MAX_HISTORY,
  QUEEN,
  type QueensState,
  buildTopology,
  canUndoQueens,
  clearCell,
  commitAction,
  createQueensGame,
  cycleCell,
  generateQueensPuzzle,
  isQueensLocked,
  paintCell,
  placeQueenAt,
  queensOf,
  recordQueensHint,
  resetQueens,
  revealQueensStep,
  undoQueens,
} from "@/games/queens/engine";

const puzzle = generateQueensPuzzle("game", "medium", { size: 6 });
const topology = buildTopology(puzzle);
const fresh = () => createQueensGame(puzzle.id, 36);

/** One tap, committed the way the UI does it. */
function tap(state: QueensState, cell: number, skipQueen = false): QueensState {
  const result = cycleCell(topology, state, cell, skipQueen);
  if (!result.ok) throw new Error(`refused: ${result.error?.rule}`);
  return commitAction(result.state, state.marks);
}
const queenOn = (state: QueensState, cell: number) => tap(tap(state, cell), cell);

describe("queens game state", () => {
  it("cycles a cell through X, queen and empty", () => {
    const cell = puzzle.solution[0];
    let state = tap(fresh(), cell);
    expect(state.marks[cell]).toBe(MARK);
    state = tap(state, cell);
    expect(state.marks[cell]).toBe(QUEEN);
    state = tap(state, cell);
    expect(state.marks[cell]).toBe(EMPTY);
    expect(state.moves).toBe(3);
    expect(state.takebacks).toBe(1);
    expect(state.history).toHaveLength(3);
  });

  it("refuses a queen that breaks a rule and leaves the board as it was", () => {
    const first = puzzle.solution[0];
    const sameRow = first % 6 === 0 ? first + 1 : first - 1;
    const state = tap(queenOn(fresh(), first), sameRow);
    const result = cycleCell(topology, state, sameRow);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    if (!result.ok) expect(result.error).toMatchObject({ rule: "same-row", with: first });
    // The tap after a refusal clears the X, so the cell is never stuck.
    const cleared = cycleCell(topology, state, sameRow, true);
    expect(cleared.ok && cleared.state.marks[sameRow]).toBe(EMPTY);
    expect(placeQueenAt(topology, state, sameRow).ok).toBe(false);
  });

  it("solves the board when the last queen goes on, and locks it", () => {
    let state = fresh();
    for (const cell of puzzle.solution) state = queenOn(state, cell);
    expect(state.status).toBe("solved");
    expect(isQueensLocked(state)).toBe(true);
    expect(state.history).toEqual([]);
    expect(state.takebacks).toBe(0);
    expect(state.moves).toBe(12);
    expect(canUndoQueens(state)).toBe(false);
    expect(cycleCell(topology, state, 0).ok).toBe(false);
    expect(undoQueens(state)).toBe(state);
    expect(resetQueens(state)).toBe(state);
    expect(paintCell(state, 0, "mark")).toBe(state);
  });

  it("paints X's over empty cells in a drag and erases them in another, as one action each", () => {
    const start = fresh();
    let state = start;
    for (const cell of [0, 1, 2, 3]) state = paintCell(state, cell, "mark");
    state = commitAction(state, start.marks);
    expect(state.marks.slice(0, 4)).toEqual([MARK, MARK, MARK, MARK]);
    expect(state.moves).toBe(1);
    expect(state.history).toHaveLength(1);

    const queen = queenOn(state, puzzle.solution[5]);
    // A drag never touches a queen, and marking a marked cell changes nothing.
    expect(paintCell(queen, puzzle.solution[5], "mark")).toBe(queen);
    expect(paintCell(queen, puzzle.solution[5], "erase")).toBe(queen);
    expect(paintCell(queen, 0, "mark")).toBe(queen);

    let erased = queen;
    for (const cell of [0, 1]) erased = paintCell(erased, cell, "erase");
    erased = commitAction(erased, queen.marks);
    expect(erased.marks.slice(0, 4)).toEqual([EMPTY, EMPTY, MARK, MARK]);
    expect(commitAction(erased, erased.marks)).toBe(erased);
  });

  it("undoes action by action and counts a queen that leaves the board", () => {
    const cell = puzzle.solution[2];
    const withQueen = queenOn(fresh(), cell);
    const undone = undoQueens(withQueen);
    expect(undone.marks[cell]).toBe(MARK);
    expect(undone.takebacks).toBe(1);
    expect(undone.moves).toBe(2);
    const again = undoQueens(undone);
    expect(again.marks[cell]).toBe(EMPTY);
    expect(again.takebacks).toBe(1);
    expect(canUndoQueens(again)).toBe(false);
    expect(clearCell(withQueen, cell).marks[cell]).toBe(EMPTY);
    expect(clearCell(again, cell)).toBe(again);
  });

  it("resets the board but keeps the counters", () => {
    const state = recordQueensHint(queenOn(tap(fresh(), 0), puzzle.solution[1]));
    const reset = resetQueens(state);
    expect(reset.marks.every((mark) => mark === EMPTY)).toBe(true);
    expect(reset.history).toEqual([]);
    expect(reset).toMatchObject({ moves: state.moves, hintsUsed: 1, takebacks: state.takebacks });
    expect(resetQueens(reset)).toBe(reset);
  });

  it("keeps a bounded undo stack", () => {
    let state = fresh();
    for (let i = 0; i < MAX_HISTORY + 20; i++) state = tap(state, 0, state.marks[0] === MARK);
    expect(state.history).toHaveLength(MAX_HISTORY);
  });

  it("reveals the solution one queen at a time, taking wrong queens off first", () => {
    const wrongCell = Array.from({ length: 36 }, (_, cell) => cell).find((cell) => !puzzle.solution.includes(cell))!;
    let state = queenOn(queenOn(fresh(), wrongCell), puzzle.solution.find((cell) => placeQueenAt(topology, queenOn(fresh(), wrongCell), cell).ok)!);
    const placedRight = queensOf(state.marks).filter((cell) => puzzle.solution.includes(cell));
    expect(placedRight).toHaveLength(1);

    state = revealQueensStep(topology, puzzle.solution, state);
    expect(state.revealed).toBe(true);
    expect(state.history).toEqual([]);
    expect(state.marks[wrongCell]).toBe(EMPTY);
    expect(isQueensLocked(state)).toBe(true);

    let steps = 0;
    while (state.status !== "solved" && steps++ < 20) state = revealQueensStep(topology, puzzle.solution, state);
    expect(state.status).toBe("solved");
    expect(steps).toBe(5);
    expect(queensOf(state.marks)).toEqual(puzzle.solution);
    expect(revealQueensStep(topology, puzzle.solution, state)).toBe(state);
  });
});
