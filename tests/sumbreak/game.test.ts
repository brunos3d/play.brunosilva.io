import { describe, expect, it } from "vitest";
import { SUMBREAK_TUTORIAL_PUZZLE } from "@/games/sumbreak/components/tutorial/tutorial-puzzle";
import {
  type SumbreakShape,
  type SumbreakState,
  beginSumbreakReveal,
  canUndoSumbreak,
  createSumbreakGame,
  generateSumbreakPuzzle,
  getSumbreakHint,
  mergeTiles,
  playMerge,
  recordSumbreakHint,
  resetSumbreak,
  rewindTo,
  tilesOnBoard,
  undoSumbreak,
  validateSumbreakPuzzle,
} from "@/games/sumbreak/engine";
import { fromSumbreakSnapshot, toSumbreakSnapshot } from "@/games/sumbreak/storage/progress";

/**
 *   1  1  .
 *   2  4  8
 *   . 32 16
 */
const SHAPE: SumbreakShape = { size: 3, cells: [1, 1, 0, 2, 4, 8, 0, 32, 16] };
const SOLUTION = [
  { from: 1, to: 0 },
  { from: 0, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 8 },
  { from: 8, to: 7 },
];
const row = (...values: number[]): number[] => [...values, ...new Array<number>(16 - values.length).fill(0)];
/** Four 1s in the top row of a 4x4. The first merge is fine either way. The second has to bring the two 2s side by side. */
const FOUR_ONES: SumbreakShape = { size: 4, cells: row(1, 1, 1, 1) };
const RUNNING = { startedAt: 1_790_000_000_000, finishedMs: null };

const play = (shape: SumbreakShape, merges: readonly { from: number; to: number }[], start = createSumbreakGame("p", shape)): SumbreakState => {
  let state = start;
  for (const merge of merges) {
    const result = mergeTiles(shape, state, merge);
    if (!result.ok) throw new Error("fixture merge refused");
    state = result.state;
  }
  return state;
};

describe("game state", () => {
  it("plays a solution to the end and counts the moves", () => {
    const state = play(SHAPE, SOLUTION);
    expect(state).toMatchObject({ status: "solved", moves: 6, mistakes: 0, brokenAt: null });
    expect(state.cells).toEqual([0, 0, 0, 0, 0, 0, 0, 64, 0]);
    // A solved board takes no more merges and cannot be undone.
    expect(mergeTiles(SHAPE, state, SOLUTION[0])).toMatchObject({ ok: false, error: null });
    expect(canUndoSumbreak(state)).toBe(false);
    expect(undoSumbreak(SHAPE, state)).toBe(state);
  });

  it("refuses an illegal merge without touching the board", () => {
    const start = createSumbreakGame("p", SHAPE);
    const result = mergeTiles(SHAPE, start, { from: 0, to: 3 });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(start);
    expect(!result.ok && result.error?.code).toBe("different");
  });

  it("plays a legal merge that ruins the board, counts it once, and remembers where it went wrong", () => {
    const wrong = play(SHAPE, [{ from: 0, to: 1 }]);
    expect(wrong).toMatchObject({ status: "playing", moves: 1, mistakes: 1, brokenAt: 0 });

    // Further merges on a broken board are not new mistakes.
    const fine = play(FOUR_ONES, [{ from: 0, to: 1 }]);
    expect(fine).toMatchObject({ mistakes: 0, brokenAt: null });
    const broken = play(FOUR_ONES, [{ from: 0, to: 1 }, { from: 2, to: 3 }]);
    expect(broken).toMatchObject({ mistakes: 1, brokenAt: 1, cells: row(0, 2, 0, 2) });

    // Undo past the bad merge clears the flag. The counters stay.
    const undone = undoSumbreak(FOUR_ONES, broken);
    expect(undone).toMatchObject({ brokenAt: null, mistakes: 1, moves: 2, cells: row(0, 2, 1, 1) });
    expect(play(FOUR_ONES, [{ from: 3, to: 2 }, { from: 2, to: 1 }], undone)).toMatchObject({ status: "solved", mistakes: 1 });
  });

  it("rewinds, resets and keeps what happened", () => {
    const state = play(SHAPE, SOLUTION.slice(0, 4));
    expect(rewindTo(SHAPE, state, 2).history).toEqual(SOLUTION.slice(0, 2));
    expect(rewindTo(SHAPE, state, 4)).toBe(state);
    expect(rewindTo(SHAPE, state, -1)).toBe(state);
    const reset = resetSumbreak(SHAPE, state);
    expect(reset).toMatchObject({ cells: SHAPE.cells, history: [], moves: 4 });
    expect(resetSumbreak(SHAPE, reset)).toBe(reset);
  });

  it("lets a hint or the reveal play merges without counting them as moves", () => {
    let state = recordSumbreakHint(createSumbreakGame("p", SHAPE));
    state = playMerge(SHAPE, state, SOLUTION[0]);
    expect(state).toMatchObject({ moves: 0, hintsUsed: 1, history: [SOLUTION[0]] });
    expect(playMerge(SHAPE, state, { from: 0, to: 1 })).toBe(state);

    let revealed = beginSumbreakReveal(createSumbreakGame("p", SHAPE));
    expect(mergeTiles(SHAPE, revealed, SOLUTION[0]).ok).toBe(false);
    for (const merge of SOLUTION) revealed = playMerge(SHAPE, revealed, merge);
    expect(revealed).toMatchObject({ status: "solved", revealed: true, moves: 0 });
  });

  it("keeps a tile's identity through merges", () => {
    expect(tilesOnBoard(SHAPE, []).map((tile) => tile.id)).toEqual([0, 1, 3, 4, 5, 7, 8]);
    const after = tilesOnBoard(SHAPE, SOLUTION.slice(0, 2));
    // The 1 on cell 1 merged into cell 0, then that tile merged into cell 3: the tile on cell 3 stayed and grew.
    expect(after.find((tile) => tile.cell === 3)).toEqual({ id: 3, cell: 3, value: 4 });
    expect(after.some((tile) => tile.cell === 0 || tile.cell === 1)).toBe(false);
  });
});

describe("hints", () => {
  it("plays the next merge of a solution and says how many ways were safe", () => {
    const hint = getSumbreakHint(SHAPE, createSumbreakGame("p", SHAPE));
    expect(hint).toMatchObject({ kind: "merge", merge: { from: 1, to: 0 } });
    expect(hint.kind === "merge" && hint.message).toBe("The smallest number goes first. Drop the 1 in row 1, column 2 onto the 1 to its left: of the 2 ways to merge the 1s, it is the only one that leaves a board that can be finished.");
    // Following hints solves the board.
    let state = createSumbreakGame("p", SHAPE);
    for (let step = 0; step < 6; step++) {
      const next = getSumbreakHint(SHAPE, state);
      if (next.kind !== "merge") throw new Error("expected a merge");
      state = playMerge(SHAPE, state, next.merge);
    }
    expect(state.status).toBe("solved");
    expect(getSumbreakHint(SHAPE, state).kind).toBe("complete");
  });

  it("names a dead end and points at the last position that can be finished", () => {
    const lonely = getSumbreakHint(SHAPE, play(SHAPE, [{ from: 0, to: 1 }]));
    expect(lonely).toMatchObject({ kind: "dead-end", keep: 0, reason: "lonely" });
    expect(lonely.kind === "dead-end" && lonely.message).toContain("A 2 has no equal neighbour left");

    const apart = getSumbreakHint(FOUR_ONES, play(FOUR_ONES, [{ from: 0, to: 1 }, { from: 2, to: 3 }]));
    expect(apart).toMatchObject({ kind: "dead-end", keep: 1 });

    // Merging the 2s before the 1s leaves a 4 the 1s can never grow into.
    const early: SumbreakShape = { size: 4, cells: row(1, 1, 2, 2) };
    expect(getSumbreakHint(early, play(early, [{ from: 2, to: 3 }]))).toMatchObject({ kind: "dead-end", keep: 0, reason: "split" });
  });

  it("solves generated boards of every tier by hints alone", () => {
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      const puzzle = generateSumbreakPuzzle("hints", difficulty);
      let state = createSumbreakGame(puzzle.id, puzzle);
      for (let step = 0; step < puzzle.size * puzzle.size; step++) {
        const hint = getSumbreakHint(puzzle, state);
        if (hint.kind !== "merge") break;
        state = playMerge(puzzle, state, hint.merge);
      }
      expect(state.status, difficulty).toBe("solved");
    }
  });
});

describe("tutorial", () => {
  it("teaches on a board that can be finished, and whose first merge can go wrong", () => {
    expect(validateSumbreakPuzzle({ ...SUMBREAK_TUTORIAL_PUZZLE, solution: SOLUTION }).problems).toEqual([]);
    expect(play(SUMBREAK_TUTORIAL_PUZZLE, [{ from: 0, to: 1 }]).brokenAt).toBe(0);
  });
});

describe("sumbreak snapshot", () => {
  const roundTrip = (snapshot: unknown, shape = SHAPE) => fromSumbreakSnapshot("p", shape, JSON.parse(JSON.stringify(snapshot)));

  it("round-trips merges, counters and the running clock", () => {
    const state = { ...play(SHAPE, SOLUTION.slice(0, 3)), hintsUsed: 2 };
    const restored = roundTrip(toSumbreakSnapshot(state, "seed", RUNNING));
    expect(restored?.state).toEqual(state);
    expect(restored?.clock).toEqual(RUNNING);
  });

  it("works out again where the board broke, whatever the file says", () => {
    const broken = play(FOUR_ONES, [{ from: 0, to: 1 }, { from: 2, to: 3 }]);
    expect(roundTrip(toSumbreakSnapshot(broken, "seed", RUNNING), FOUR_ONES)?.state).toEqual(broken);
  });

  it("restores a finished board as solved only when one tile is left and the clock has stopped", () => {
    const solved = play(SHAPE, SOLUTION);
    const done = { startedAt: 1, finishedMs: 30_000 };
    expect(roundTrip(toSumbreakSnapshot(solved, "seed", done))?.state.status).toBe("solved");
    expect(roundTrip(toSumbreakSnapshot(solved, "seed", RUNNING))).toBeNull();
    expect(roundTrip(toSumbreakSnapshot(play(SHAPE, SOLUTION.slice(0, 2)), "seed", done))).toBeNull();
  });

  it("rejects merges the rules would refuse, and anything malformed", () => {
    const good = toSumbreakSnapshot(play(SHAPE, SOLUTION.slice(0, 2)), "seed", RUNNING);
    expect(roundTrip({ ...good, history: [[0, 3]] })).toBeNull();
    expect(roundTrip({ ...good, history: [[1, 0], [1, 0]] })).toBeNull();
    expect(roundTrip({ ...good, history: [[1, 0, 3]] })).toBeNull();
    expect(roundTrip({ ...good, history: "none" })).toBeNull();
    expect(roundTrip({ ...good, moves: -1 })).toBeNull();
    expect(roundTrip({ ...good, puzzleId: "other" })).toBeNull();
    expect(roundTrip({ ...good, snapshotVersion: 99 })).toBeNull();
    expect(roundTrip(null)).toBeNull();
  });
});
