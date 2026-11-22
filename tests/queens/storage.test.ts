import { describe, expect, it } from "vitest";
import { MARK, QUEEN, type QueensState, buildTopology, commitAction, createQueensGame, cycleCell, generateQueensPuzzle, paintCell, revealQueensStep } from "@/games/queens/engine";
import { fromQueensSnapshot, toQueensSnapshot } from "@/games/queens/storage/progress";

const puzzle = generateQueensPuzzle("storage", "medium", { size: 6 });
const topology = buildTopology(puzzle);
const RUNNING = { startedAt: 1_790_000_000_000, finishedMs: null };

function place(state: QueensState, cell: number): QueensState {
  let next = state;
  for (let taps = 0; taps < 2; taps++) {
    const result = cycleCell(topology, next, cell);
    if (!result.ok) throw new Error("fixture");
    next = commitAction(result.state, next.marks);
  }
  return next;
}

function play(queens: number): QueensState {
  let state = createQueensGame(puzzle.id, 36);
  const noted = Array.from({ length: 36 }, (_, cell) => cell).filter((cell) => !puzzle.solution.includes(cell)).slice(0, 3);
  const before = state.marks;
  for (const cell of noted) state = paintCell(state, cell, "mark");
  state = commitAction(state, before);
  for (const cell of puzzle.solution.slice(0, queens)) state = place(state, cell);
  return state;
}

const roundTrip = (snapshot: unknown) => fromQueensSnapshot(puzzle.id, topology, JSON.parse(JSON.stringify(snapshot)));

describe("queens snapshot", () => {
  it("round-trips a board, its undo stack and the running clock", () => {
    const state = play(3);
    const restored = roundTrip(toQueensSnapshot(state, puzzle.seed, RUNNING));
    expect(restored?.state).toEqual(state);
    expect(restored?.clock).toEqual(RUNNING);
    expect(toQueensSnapshot(state, puzzle.seed, RUNNING)).toMatchObject({ startedAt: RUNNING.startedAt, finishedMs: null, seed: puzzle.seed });
  });

  it("restores a finished board as solved only when the validator agrees", () => {
    const solved = play(6);
    expect(solved.status).toBe("solved");
    expect(roundTrip(toQueensSnapshot(solved, puzzle.seed, { startedAt: 1, finishedMs: 30_000 }))?.state.status).toBe("solved");
    // Solved boards carry a final time, and unfinished ones must not.
    expect(roundTrip(toQueensSnapshot(solved, puzzle.seed, RUNNING))).toBeNull();
    expect(roundTrip(toQueensSnapshot(play(4), puzzle.seed, { startedAt: 1, finishedMs: 30_000 }))).toBeNull();
  });

  it("rejects a tampered board", () => {
    const good = toQueensSnapshot(play(2), puzzle.seed, RUNNING);
    const first = puzzle.solution[0];
    const clash = first % 6 === 0 ? first + 1 : first - 1;
    expect(roundTrip({ ...good, marks: good.marks.map((mark, cell) => (cell === clash ? QUEEN : mark)) })).toBeNull();
    expect(roundTrip({ ...good, marks: good.marks.slice(1) })).toBeNull();
    expect(roundTrip({ ...good, marks: good.marks.map((mark, cell) => (cell === 35 ? 7 : mark)) })).toBeNull();
    expect(roundTrip({ ...good, history: [[1, 2, 3]] })).toBeNull();
    expect(roundTrip({ ...good, history: new Array(500).fill(good.marks) })).toBeNull();
    expect(roundTrip({ ...good, puzzleId: "other" })).toBeNull();
    expect(roundTrip({ ...good, takebacks: -1 })).toBeNull();
    expect(roundTrip({ ...good, snapshotVersion: 99 })).toBeNull();
    expect(fromQueensSnapshot(puzzle.id, topology, null)).toBeNull();
    expect(fromQueensSnapshot(puzzle.id, topology, "junk")).toBeNull();
  });

  it("keeps the player's notes and remembers a reveal in progress", () => {
    const state = play(2);
    expect(roundTrip(toQueensSnapshot(state, puzzle.seed, RUNNING))?.state.marks.filter((mark) => mark === MARK)).toHaveLength(3);
    const revealing = revealQueensStep(topology, puzzle.solution, state);
    expect(roundTrip(toQueensSnapshot(revealing, puzzle.seed, RUNNING))?.state.revealed).toBe(true);
  });
});
