import { describe, expect, it } from "vitest";
import { WEND_TUTORIAL_PUZZLE } from "@/games/wend/components/tutorial/tutorial-puzzle";
import {
  type Stroke,
  type WendShape,
  type WendState,
  applyWendHint,
  beginWendReveal,
  canResetWend,
  canUndoWend,
  createWendGame,
  endStroke,
  foundWords,
  generateWendPuzzle,
  isWendLocked,
  longestOpenWord,
  moveStroke,
  openTrails,
  resetWend,
  revealWord,
  shortenActiveTrail,
  startStroke,
  trailLetters,
  undoWend,
  wordListRows,
  wordStartedBy,
} from "@/games/wend/engine";
import { fromWendSnapshot, toWendSnapshot } from "@/games/wend/storage/progress";

/**
 *   U V A      UVA along the top, FIGO around the corner: F, I, G, O.
 *   # O G
 *   # F I
 */
const SHAPE: WendShape = WEND_TUTORIAL_PUZZLE;
const RUNNING = { startedAt: 1_790_000_000_000, finishedMs: null };

/** One press, a drag through the given cells, and a release. */
function stroke(shape: WendShape, state: WendState, cells: readonly number[]) {
  const started = startStroke(shape, state, cells[0]);
  if (!started) return { state, changed: false, found: null, solved: false, erased: false, elsewhere: false };
  let current = started.state;
  let active: Stroke = started.stroke;
  for (const cell of cells.slice(1)) ({ state: current, stroke: active } = moveStroke(shape, current, active, cell));
  return endStroke(shape, current, active);
}
const tap = (shape: WendShape, state: WendState, cell: number) => stroke(shape, state, [cell]);
const cellsOf = (state: WendState): number[][] => state.trails.map((trail) => [...trail.cells]);

describe("drawing trails", () => {
  it("starts a trail on a letter and ignores walls", () => {
    const fresh = createWendGame("t");
    expect(startStroke(SHAPE, fresh, 3)).toBeNull();
    const started = startStroke(SHAPE, fresh, 7);
    expect(started?.state.trails).toHaveLength(1);
    expect(started?.state.trails[0].cells).toEqual([7]);
  });

  it("grows along neighbours, shrinks when the pointer goes back, and counts one move per gesture", () => {
    const drawn = stroke(SHAPE, createWendGame("t"), [7, 8, 5, 8]);
    expect(cellsOf(drawn.state)).toEqual([[7, 8]]);
    expect(drawn.changed).toBe(true);
    expect(drawn.found).toBeNull();
    expect(drawn.state.moves).toBe(1);
    expect(trailLetters(SHAPE, drawn.state.trails[0].cells)).toBe("FI");
  });

  it("does not step diagonally, onto a wall or onto another trail", () => {
    const first = stroke(SHAPE, createWendGame("t"), [0, 1]);
    // From O (cell 4): the wall at 3, the diagonal at 8 and the trail at 1 are all refused.
    const second = stroke(SHAPE, first.state, [4, 3, 8, 1]);
    expect(cellsOf(second.state)).toEqual([[0, 1], [4]]);
  });

  it("fills a straight line when the pointer jumps cells", () => {
    const open: WendShape = { size: 3, letters: ["A", "B", "C", "D", "E", "F", "G", "H", "I"], words: [{ text: "DEHG", display: "DEHG", path: [3, 4, 7, 6] }, { text: "ABCFI", display: "ABCFI", path: [0, 1, 2, 5, 8] }] };
    const jumped = stroke(open, createWendGame("t"), [0, 2, 8]);
    expect(jumped.found).toBe(1);
    expect(cellsOf(jumped.state)).toEqual([[0, 1, 2, 5, 8]]);
  });

  it("never grows a trail past the longest hidden word", () => {
    const state = stroke(SHAPE, createWendGame("t"), [0, 1, 2, 5, 8, 7]).state;
    expect(longestOpenWord(SHAPE, createWendGame("t"))).toBe(4);
    expect(cellsOf(state)).toEqual([[0, 1, 2, 5]]);
  });

  it("finds a word only over its own cells, in reading order", () => {
    const found = stroke(SHAPE, createWendGame("t"), [0, 1, 2]);
    expect(found.found).toBe(0);
    expect(found.state.trails[0].word).toBe(0);
    expect(found.solved).toBe(false);
    // The same cells backwards spell AVU.
    expect(stroke(SHAPE, createWendGame("t"), [2, 1, 0]).found).toBeNull();
    const solved = stroke(SHAPE, found.state, [7, 8, 5, 4]);
    expect(solved.found).toBe(1);
    expect(solved.solved).toBe(true);
    expect(solved.state.status).toBe("solved");
    expect(isWendLocked(solved.state)).toBe(true);
    expect(startStroke(SHAPE, solved.state, 0)).toBeNull();
  });

  it("says when a hidden word was traced over the wrong cells", () => {
    //  A B     AB lives in the top row, BA in the bottom row.
    //  B A
    const twins: WendShape = { size: 2, letters: ["A", "B", "B", "A"], words: [{ text: "AB", display: "AB", path: [0, 1] }, { text: "BA", display: "BA", path: [2, 3] }] };
    const wrong = stroke(twins, createWendGame("t"), [0, 2]);
    expect(wrong.found).toBeNull();
    expect(wrong.elsewhere).toBe(true);
    expect(stroke(twins, createWendGame("t"), [0, 1]).found).toBe(0);
  });

  it("leaves a found word alone", () => {
    const found = stroke(SHAPE, createWendGame("t"), [0, 1, 2]).state;
    expect(startStroke(SHAPE, found, 1)).toBeNull();
    const crossing = stroke(SHAPE, found, [5, 2]);
    expect(cellsOf(crossing.state)).toEqual([[0, 1, 2], [5]]);
  });
});

describe("taps", () => {
  it("adds a tapped letter to the end of the trail touched last", () => {
    let state = tap(SHAPE, createWendGame("t"), 7).state;
    state = tap(SHAPE, state, 8).state;
    state = tap(SHAPE, state, 5).state;
    expect(cellsOf(state)).toEqual([[7, 8, 5]]);
    const done = tap(SHAPE, state, 4);
    expect(done.found).toBe(1);
  });

  it("starts a new trail when the tapped letter is not next to that end", () => {
    let state = tap(SHAPE, createWendGame("t"), 7).state;
    state = tap(SHAPE, state, 0).state;
    expect(cellsOf(state)).toEqual([[7], [0]]);
    // The new trail is now the one a tap extends.
    state = tap(SHAPE, state, 1).state;
    expect(cellsOf(state)).toEqual([[7], [0, 1]]);
  });

  it("cuts a trail at a tapped middle letter and erases it at its first letter", () => {
    const drawn = stroke(SHAPE, createWendGame("t"), [7, 8, 5]).state;
    const cut = tap(SHAPE, drawn, 8);
    expect(cellsOf(cut.state)).toEqual([[7, 8]]);
    expect(cut.erased).toBe(false);
    const erased = tap(SHAPE, cut.state, 7);
    expect(erased.state.trails).toHaveLength(0);
    expect(erased.erased).toBe(true);
    expect(erased.state.mistakes).toBe(1);
    // A one-letter trail is not a word attempt, so erasing it is not counted.
    const single = tap(SHAPE, createWendGame("t"), 7).state;
    expect(tap(SHAPE, single, 7).state.mistakes).toBe(0);
  });

  it("changes nothing on a tap at the end of a trail", () => {
    const drawn = stroke(SHAPE, createWendGame("t"), [7, 8]).state;
    const same = tap(SHAPE, drawn, 8);
    expect(same.changed).toBe(false);
    expect(same.state.moves).toBe(drawn.moves);
    expect(cellsOf(same.state)).toEqual([[7, 8]]);
  });

  it("cuts and redraws when a drag starts in the middle of a trail", () => {
    const drawn = stroke(SHAPE, createWendGame("t"), [0, 1, 2, 5]).state;
    const redrawn = stroke(SHAPE, drawn, [1, 4]);
    expect(cellsOf(redrawn.state)).toEqual([[0, 1, 4]]);
  });
});

describe("keyboard", () => {
  it("takes one letter off the trail touched last, and the trail itself with its last letter", () => {
    const drawn = stroke(SHAPE, createWendGame("t"), [7, 8, 5]).state;
    const shorter = shortenActiveTrail(drawn);
    expect(cellsOf(shorter)).toEqual([[7, 8]]);
    expect(cellsOf(shortenActiveTrail(shorter))).toEqual([[7]]);
    const gone = shortenActiveTrail(shortenActiveTrail(shorter));
    expect(gone.trails).toHaveLength(0);
    expect(shortenActiveTrail(gone)).toBe(gone);
    expect(cellsOf(undoWend(shorter))).toEqual([[7, 8, 5]]);
  });
});

describe("undo and reset", () => {
  it("undoes one gesture at a time", () => {
    const first = stroke(SHAPE, createWendGame("t"), [7, 8]).state;
    const second = stroke(SHAPE, first, [0, 1]).state;
    expect(canUndoWend(second)).toBe(true);
    const back = undoWend(second);
    expect(cellsOf(back)).toEqual([[7, 8]]);
    expect(cellsOf(undoWend(back))).toEqual([]);
    expect(canUndoWend(undoWend(back))).toBe(false);
  });

  it("never undoes a found word", () => {
    const draft = stroke(SHAPE, createWendGame("t"), [7, 8]).state;
    const found = stroke(SHAPE, draft, [0, 1, 2]).state;
    expect(canUndoWend(found)).toBe(false);
    expect(undoWend(found)).toBe(found);
    expect(foundWords(found)).toEqual([0]);
  });

  it("resets the open trails only", () => {
    let state = stroke(SHAPE, createWendGame("t"), [0, 1, 2]).state;
    expect(canResetWend(state)).toBe(false);
    state = stroke(SHAPE, state, [7, 8]).state;
    state = stroke(SHAPE, state, [4]).state;
    const reset = resetWend(state);
    expect(cellsOf(reset)).toEqual([[0, 1, 2]]);
    // FI counts as a thrown away attempt. The lone O does not.
    expect(reset.mistakes).toBe(1);
    expect(cellsOf(undoWend(reset))).toEqual([[0, 1, 2], [7, 8], [4]]);
  });
});

describe("hints", () => {
  it("reveals the first letter of the shortest word, then the next ones, then finds it", () => {
    const first = applyWendHint(SHAPE, createWendGame("t"));
    expect(first).toMatchObject({ word: 0, cell: 0, first: true, found: false, cleared: 0 });
    expect(wordListRows(SHAPE, first!.state)[0]).toMatchObject({ found: false, shown: 1 });
    const second = applyWendHint(SHAPE, first!.state);
    expect(second).toMatchObject({ word: 0, cell: 1, first: false, found: false });
    const third = applyWendHint(SHAPE, second!.state);
    expect(third).toMatchObject({ word: 0, cell: 2, found: true, solved: false });
    expect(third!.state.hintsUsed).toBe(3);
    expect(foundWords(third!.state)).toEqual([0]);
  });

  it("erases trails that lead nowhere and keeps the ones on the right track", () => {
    let state = stroke(SHAPE, createWendGame("t"), [7, 8]).state; // FI, the start of FIGO
    state = stroke(SHAPE, state, [2, 1]).state; // AV, nothing
    expect(wordStartedBy(SHAPE, state, [7, 8])).toBe(1);
    expect(wordStartedBy(SHAPE, state, [2, 1])).toBeNull();
    const hint = applyWendHint(SHAPE, state);
    expect(hint).toMatchObject({ cleared: 1, word: 1, cell: 5, first: false });
    expect(cellsOf(hint!.state)).toEqual([[7, 8, 5]]);
    expect(hint!.state.mistakes).toBe(1);
    expect(canUndoWend(hint!.state)).toBe(false);
  });

  it("shows hinted letters in the word list, and never the ones the player traced", () => {
    const traced = stroke(SHAPE, createWendGame("t"), [7, 8]).state;
    expect(wordListRows(SHAPE, traced)[1]).toMatchObject({ found: false, shown: 0 });
    const hinted = applyWendHint(SHAPE, traced)!.state;
    expect(wordListRows(SHAPE, hinted)[1]).toMatchObject({ found: false, shown: 3 });
    // Cutting the trail back keeps only the hinted letters that are still there.
    const cut = tap(SHAPE, hinted, 7 + 1).state;
    expect(wordListRows(SHAPE, cut)[1]).toMatchObject({ shown: 2 });
  });

  it("finishes the puzzle when the last letter is a hint", () => {
    let state = stroke(SHAPE, createWendGame("t"), [0, 1, 2]).state;
    state = stroke(SHAPE, state, [7, 8, 5]).state;
    const hint = applyWendHint(SHAPE, state);
    expect(hint).toMatchObject({ found: true, solved: true });
    expect(applyWendHint(SHAPE, hint!.state)).toBeNull();
  });
});

describe("reveal", () => {
  it("drops the open trails and lays the words down one at a time", () => {
    let state = stroke(SHAPE, createWendGame("t"), [0, 1, 2]).state;
    state = stroke(SHAPE, state, [8, 5]).state;
    state = beginWendReveal(state);
    expect(state.revealed).toBe(true);
    expect(openTrails(state)).toHaveLength(0);
    expect(isWendLocked(state)).toBe(true);
    state = revealWord(SHAPE, state);
    expect(state.status).toBe("solved");
    expect(foundWords(state).sort()).toEqual([0, 1]);
    expect(revealWord(SHAPE, state)).toBe(state);
  });
});

describe("storage", () => {
  it("round-trips a game in progress", () => {
    let state = stroke(SHAPE, createWendGame("p"), [0, 1, 2]).state;
    state = applyWendHint(SHAPE, state)!.state;
    state = stroke(SHAPE, state, [4]).state;
    const restored = fromWendSnapshot("p", SHAPE, JSON.parse(JSON.stringify(toWendSnapshot(state, "seed", RUNNING))));
    expect(restored?.state.trails.map((trail) => ({ cells: trail.cells, word: trail.word, hinted: trail.hinted }))).toEqual(state.trails.map((trail) => ({ cells: trail.cells, word: trail.word, hinted: trail.hinted })));
    expect(restored?.state).toMatchObject({ moves: state.moves, mistakes: state.mistakes, hintsUsed: 1, status: "playing" });
    expect(restored?.clock).toEqual(RUNNING);
  });

  it("round-trips a solved game of a generated puzzle", () => {
    const puzzle = generateWendPuzzle("stored", "medium");
    let state = createWendGame(puzzle.id);
    for (const word of puzzle.words) state = stroke(puzzle, state, word.path).state;
    expect(state.status).toBe("solved");
    const restored = fromWendSnapshot(puzzle.id, puzzle, toWendSnapshot(state, puzzle.seed, { startedAt: 1, finishedMs: 5_000 }));
    expect(restored?.state.status).toBe("solved");
    expect(foundWords(restored!.state)).toHaveLength(puzzle.words.length);
  });

  it("rejects tampered snapshots", () => {
    const state = stroke(SHAPE, createWendGame("p"), [7, 8]).state;
    const good = toWendSnapshot(state, "seed", RUNNING);
    expect(fromWendSnapshot("p", SHAPE, good)).not.toBeNull();
    expect(fromWendSnapshot("other", SHAPE, good)).toBeNull();
    expect(fromWendSnapshot("p", SHAPE, { ...good, snapshotVersion: 99 })).toBeNull();
    // A trail over a wall, a trail that jumps, and two trails on one cell.
    expect(fromWendSnapshot("p", SHAPE, { ...good, trails: [{ cells: [3, 4], hinted: 0 }] })).toBeNull();
    expect(fromWendSnapshot("p", SHAPE, { ...good, trails: [{ cells: [0, 8], hinted: 0 }] })).toBeNull();
    expect(fromWendSnapshot("p", SHAPE, { ...good, trails: [{ cells: [0, 1], hinted: 0 }, { cells: [1, 2], hinted: 0 }] })).toBeNull();
    expect(fromWendSnapshot("p", SHAPE, { ...good, moves: -1 })).toBeNull();
    // A board that is not solved cannot carry a final time, and a solved one must.
    expect(fromWendSnapshot("p", SHAPE, { ...good, finishedMs: 1_000 })).toBeNull();
    const solved = { ...good, trails: [{ cells: [0, 1, 2], hinted: 0 }, { cells: [7, 8, 5, 4], hinted: 0 }] };
    expect(fromWendSnapshot("p", SHAPE, solved)).toBeNull();
    expect(fromWendSnapshot("p", SHAPE, { ...solved, finishedMs: 1_000 })?.state.status).toBe("solved");
    // Hinted letters are only trusted when the trail really starts a hidden word.
    expect(fromWendSnapshot("p", SHAPE, { ...good, trails: [{ cells: [2, 1], hinted: 2 }] })?.state.trails[0].hinted).toBe(0);
    expect(fromWendSnapshot("p", SHAPE, null)).toBeNull();
  });
});
