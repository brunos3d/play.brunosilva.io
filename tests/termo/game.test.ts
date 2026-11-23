import { describe, expect, it } from "vitest";
import {
  type TermoShape,
  type TermoState,
  boardRows,
  clearDraft,
  countSolved,
  createTermoGame,
  eraseLetter,
  hintLetters,
  isTermoLocked,
  knownPositions,
  moveCursor,
  nextHint,
  recordTermoHint,
  revealTermo,
  setCursor,
  solvedBoards,
  submitGuess,
  termoScore,
  typeLetter,
} from "@/games/termo/engine";
import { fromTermoSnapshot, toTermoSnapshot } from "@/games/termo/storage/progress";

const ONE: TermoShape = { answers: ["carta"], maxGuesses: 6 };
const TWO: TermoShape = { answers: ["carta", "livro"], maxGuesses: 7 };
const RUNNING = { startedAt: 1_000, finishedMs: null };
const DONE = { startedAt: 1_000, finishedMs: 42_000 };

const type = (state: TermoState, word: string): TermoState => [...word].reduce(typeLetter, state);
/** Types each word and plays it. Throws if a guess is refused, so a typo in a test is loud. */
function play(shape: TermoShape, words: readonly string[], from: TermoState = createTermoGame("p")): TermoState {
  let state = from;
  for (const word of words) {
    const result = submitGuess(shape, type(state, word));
    if (!result.ok) throw new Error(`"${word}" was refused: ${result.error?.message}`);
    state = result.state;
  }
  return state;
}

describe("typing a row", () => {
  it("fills the row left to right and stops when it is full", () => {
    let state = type(createTermoGame("p"), "fes");
    expect(state.draft).toEqual(["f", "e", "s", "", ""]);
    expect(state.cursor).toBe(3);
    state = type(state, "tax");
    expect(state.draft.join("")).toBe("festa");
    expect(state.cursor).toBe(5);
  });

  it("ignores anything that is not one plain letter", () => {
    const state = createTermoGame("p");
    for (const key of ["A", "ç", "1", "ab", ""]) expect(typeLetter(state, key)).toBe(state);
  });

  it("types at the cursor and then jumps to the next empty position", () => {
    let state = type(createTermoGame("p"), "fe");
    state = setCursor(state, 4);
    state = typeLetter(state, "a");
    expect(state.draft).toEqual(["f", "e", "", "", "a"]);
    // Past the last position the search wraps around to the first gap.
    expect(state.cursor).toBe(2);
    state = setCursor(state, 0);
    state = typeLetter(state, "t");
    expect(state.draft).toEqual(["t", "e", "", "", "a"]);
    expect(state.cursor).toBe(2);
  });

  it("erases the letter under the cursor, or the one before it", () => {
    let state = type(createTermoGame("p"), "festa");
    state = eraseLetter(state);
    expect(state.draft).toEqual(["f", "e", "s", "t", ""]);
    expect(state.cursor).toBe(4);
    state = setCursor(state, 1);
    state = eraseLetter(state);
    expect(state.draft).toEqual(["f", "", "s", "t", ""]);
    expect(state.cursor).toBe(1);
    state = eraseLetter(state);
    expect(state.draft).toEqual(["", "", "s", "t", ""]);
    expect(state.cursor).toBe(0);
    expect(eraseLetter(state)).toBe(state);
  });

  it("clears the whole row at once", () => {
    const state = clearDraft(type(createTermoGame("p"), "fes"));
    expect(state.draft).toEqual(["", "", "", "", ""]);
    expect(state.cursor).toBe(0);
    expect(clearDraft(state)).toBe(state);
  });

  it("moves the cursor inside the row only", () => {
    let state = type(createTermoGame("p"), "festa");
    state = moveCursor(state, -1);
    expect(state.cursor).toBe(4);
    state = moveCursor(state, -9);
    expect(state.cursor).toBe(0);
    expect(moveCursor(state, -1)).toBe(state);
    expect(setCursor(state, 5)).toBe(state);
    expect(setCursor(state, 2).cursor).toBe(2);
  });
});

describe("playing guesses", () => {
  it("refuses a short row and an unknown word and leaves the row as typed", () => {
    const short = type(createTermoGame("p"), "fes");
    expect(submitGuess(ONE, short)).toMatchObject({ ok: false, state: short, error: { code: "incomplete" } });
    const unknown = type(createTermoGame("p"), "xxxxx");
    expect(submitGuess(ONE, unknown)).toMatchObject({ ok: false, state: unknown, error: { code: "unknown" } });
  });

  it("plays a known word, empties the row and wins when the word is found", () => {
    let state = play(ONE, ["campo"]);
    expect(state).toMatchObject({ guesses: ["campo"], status: "playing", cursor: 0 });
    expect(state.draft.join("")).toBe("");
    state = play(ONE, ["carta"], state);
    expect(state.status).toBe("solved");
    expect(isTermoLocked(state)).toBe(true);
    expect(termoScore(ONE, state)).toEqual({ moves: 2, mistakes: 1, hintsUsed: 0 });
    // A finished game takes no more input.
    expect(typeLetter(state, "a")).toBe(state);
    expect(submitGuess(ONE, state).ok).toBe(false);
  });

  it("is lost when the guesses run out", () => {
    const state = play(ONE, ["campo", "mundo", "livro", "festa", "nuvem", "porta"]);
    expect(state.status).toBe("lost");
    expect(termoScore(ONE, state)).toEqual({ moves: 6, mistakes: 6, hintsUsed: 0 });
    expect(boardRows(ONE, state, 0).every((row) => row.kind === "played")).toBe(true);
  });

  it("plays one guess on every open board, and a solved board stops taking guesses", () => {
    const first = submitGuess(TWO, type(createTermoGame("p"), "livro"));
    expect(first).toMatchObject({ ok: true, found: [1] });
    let state = first.state;
    expect(solvedBoards(TWO, state.guesses)).toEqual([false, true]);
    expect(state.status).toBe("playing");

    state = play(TWO, ["campo"], state);
    const open = boardRows(TWO, state, 0);
    const solved = boardRows(TWO, state, 1);
    expect(open.map((row) => row.kind)).toEqual(["played", "played", "current", "empty", "empty", "empty", "empty"]);
    // The solved board keeps one played row. "campo" was not played on it.
    expect(solved.map((row) => row.kind)).toEqual(["played", "empty", "empty", "empty", "empty", "empty", "empty"]);
    expect(solved[0].marks).toEqual(["right", "right", "right", "right", "right"]);

    state = play(TWO, ["carta"], state);
    expect(state.status).toBe("solved");
    expect(countSolved(TWO, state.guesses)).toBe(2);
    expect(termoScore(TWO, state)).toEqual({ moves: 3, mistakes: 1, hintsUsed: 0 });
  });

  it("is lost with a board still open, even if the other one was found", () => {
    const state = play(TWO, ["livro", "campo", "mundo", "festa", "nuvem", "porta", "sagaz"]);
    expect(state.status).toBe("lost");
    expect(solvedBoards(TWO, state.guesses)).toEqual([false, true]);
  });
});

describe("hints and reveal", () => {
  it("gives the first unknown letter of the first open board", () => {
    let state = createTermoGame("p");
    expect(nextHint(TWO, state)).toEqual({ board: 0, index: 0 });
    // "campo" puts C and A of "carta" in place, so the next hint is the third letter.
    state = play(TWO, ["campo"], state);
    expect(knownPositions(TWO, state, 0)).toEqual([true, true, false, false, false]);
    expect(nextHint(TWO, state)).toEqual({ board: 0, index: 2 });
    state = recordTermoHint(state, { board: 0, index: 2 });
    expect(hintLetters(TWO, state, 0)).toEqual(["", "", "r", "", ""]);
    expect(hintLetters(TWO, state, 1)).toEqual(["", "", "", "", ""]);
    expect(nextHint(TWO, state)).toEqual({ board: 0, index: 3 });
    expect(termoScore(TWO, state).hintsUsed).toBe(1);
  });

  it("moves on to the next board once a board is solved or fully known", () => {
    let state = play(TWO, ["carta"]);
    expect(nextHint(TWO, state)).toEqual({ board: 1, index: 0 });
    for (let index = 0; index < 5; index++) state = recordTermoHint(state, { board: 1, index });
    expect(nextHint(TWO, state)).toBeNull();
  });

  it("reveal ends the game without a win", () => {
    const state = revealTermo(type(play(ONE, ["campo"]), "fe"));
    expect(state).toMatchObject({ revealed: true, status: "playing" });
    expect(state.draft.join("")).toBe("");
    expect(isTermoLocked(state)).toBe(true);
    expect(nextHint(ONE, state)).toBeNull();
    expect(boardRows(ONE, state, 0).map((row) => row.kind)).toEqual(["played", "empty", "empty", "empty", "empty", "empty"]);
    expect(revealTermo(state)).toBe(state);
  });
});

describe("termo snapshot", () => {
  const roundTrip = (snapshot: unknown, shape = ONE) => fromTermoSnapshot("p", shape, JSON.parse(JSON.stringify(snapshot)));

  it("restores guesses, the row being typed, the cursor and the hints", () => {
    const state = setCursor(type(recordTermoHint(play(TWO, ["campo"]), { board: 0, index: 2 }), "fes"), 1);
    const restored = roundTrip(toTermoSnapshot(state, "seed", RUNNING), TWO);
    expect(restored?.state).toEqual(state);
    expect(restored?.clock).toEqual(RUNNING);
  });

  it("restores a finished game only with a final time, and an open game only without one", () => {
    const won = play(ONE, ["campo", "carta"]);
    expect(roundTrip(toTermoSnapshot(won, "seed", DONE))?.state.status).toBe("solved");
    expect(roundTrip(toTermoSnapshot(won, "seed", RUNNING))).toBeNull();
    expect(roundTrip(toTermoSnapshot(play(ONE, ["campo"]), "seed", DONE))).toBeNull();
    const revealed = revealTermo(play(ONE, ["campo"]));
    expect(roundTrip(toTermoSnapshot(revealed, "seed", DONE))?.state).toMatchObject({ revealed: true, status: "playing" });
    const lost = play(ONE, ["campo", "mundo", "livro", "festa", "nuvem", "porta"]);
    expect(roundTrip(toTermoSnapshot(lost, "seed", DONE))?.state.status).toBe("lost");
  });

  it("works the status out again instead of trusting what was stored", () => {
    const snapshot = { ...toTermoSnapshot(play(ONE, ["campo", "carta"]), "seed", DONE), status: "playing" };
    expect(roundTrip(snapshot)?.state.status).toBe("solved");
  });

  it("rejects data that could not have come from a real game", () => {
    const good = toTermoSnapshot(play(ONE, ["campo"]), "seed", RUNNING);
    expect(roundTrip(good)).not.toBeNull();
    expect(roundTrip(null)).toBeNull();
    expect(roundTrip({ ...good, snapshotVersion: 2 })).toBeNull();
    expect(roundTrip({ ...good, puzzleId: "other" })).toBeNull();
    expect(roundTrip({ ...good, guesses: ["xxxxx"] })).toBeNull();
    expect(roundTrip({ ...good, guesses: ["CAMPO"] })).toBeNull();
    expect(roundTrip({ ...good, guesses: "campo" })).toBeNull();
    // A guess after the winning one, and more guesses than the game allows.
    expect(roundTrip({ ...good, guesses: ["carta", "campo"], finishedMs: 5 })).toBeNull();
    expect(roundTrip({ ...good, guesses: ["campo", "mundo", "livro", "festa", "nuvem", "porta", "sagaz"], finishedMs: 5 })).toBeNull();
    expect(roundTrip({ ...good, hints: [[1, 0]] })).toBeNull();
    expect(roundTrip({ ...good, hints: [[0, 5]] })).toBeNull();
    expect(roundTrip({ ...good, hints: [[0, 1], [0, 1]] })).toBeNull();
    expect(roundTrip({ ...good, hints: "x" })).toBeNull();
  });

  it("drops a damaged row being typed and keeps the guesses", () => {
    const good = toTermoSnapshot(type(play(ONE, ["campo"]), "fe"), "seed", RUNNING);
    const restored = roundTrip({ ...good, draft: ["f", "E", 3] });
    expect(restored?.state.guesses).toEqual(["campo"]);
    expect(restored?.state.draft.join("")).toBe("");
    expect(roundTrip({ ...good, cursor: 99 })?.state.cursor).toBe(0);
  });
});
