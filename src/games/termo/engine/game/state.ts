import { type GuessError, checkGuess, scoreGuess, solvedAt } from "../rules";
import type { LetterMark, TermoShape } from "../types";
import { WORD_LENGTH } from "../words";

/** A letter of an answer the game gave away: position `index` of the word on `board`. */
export type TermoHint = { board: number; index: number };

/**
 * One game of Termo as plain data. Guesses are final, so there is no history to
 * walk back: the state is the guesses made, the row being typed and the hints
 * taken. Everything else, such as which boards are solved, follows from those.
 */
export type TermoState = {
  puzzleId: string;
  /** Guesses played, plain five-letter words, oldest first. */
  guesses: readonly string[];
  /** The row being typed: one entry per position, empty where there is no letter yet. */
  draft: readonly string[];
  /** Where the next letter goes, 0 to 5. Five means the row is full and the cursor sits past its end. */
  cursor: number;
  hints: readonly TermoHint[];
  status: "playing" | "solved" | "lost";
  /** The player asked for the answers. */
  revealed: boolean;
};

const EMPTY_DRAFT: readonly string[] = new Array(WORD_LENGTH).fill("");

export function createTermoGame(puzzleId: string): TermoState {
  return { puzzleId, guesses: [], draft: EMPTY_DRAFT, cursor: 0, hints: [], status: "playing", revealed: false };
}

export const isTermoLocked = (state: TermoState): boolean => state.status !== "playing" || state.revealed;

/** Boards whose word has been found. */
export function solvedBoards(shape: TermoShape, guesses: readonly string[]): boolean[] {
  return shape.answers.map((answer) => solvedAt(answer, guesses) !== -1);
}

export const countSolved = (shape: TermoShape, guesses: readonly string[]): number => solvedBoards(shape, guesses).filter(Boolean).length;

/** Status that a list of guesses leads to. */
export function statusAfter(shape: TermoShape, guesses: readonly string[]): TermoState["status"] {
  if (countSolved(shape, guesses) === shape.answers.length) return "solved";
  return guesses.length >= shape.maxGuesses ? "lost" : "playing";
}

/** First empty position at or after `from`, wrapping around. Five when the row is full. */
function nextEmpty(draft: readonly string[], from: number): number {
  for (let step = 0; step < WORD_LENGTH; step++) {
    const index = (from + step) % WORD_LENGTH;
    if (draft[index] === "") return index;
  }
  return WORD_LENGTH;
}

/** Puts a letter at the cursor and moves on to the next empty position. On a full row with the cursor past the end, nothing happens. */
export function typeLetter(state: TermoState, letter: string): TermoState {
  if (isTermoLocked(state) || !/^[a-z]$/.test(letter) || state.cursor >= WORD_LENGTH) return state;
  const draft = [...state.draft];
  draft[state.cursor] = letter;
  return { ...state, draft, cursor: nextEmpty(draft, state.cursor + 1 >= WORD_LENGTH ? 0 : state.cursor + 1) };
}

/** Backspace: clears the letter under the cursor, or steps left and clears that one. */
export function eraseLetter(state: TermoState): TermoState {
  if (isTermoLocked(state)) return state;
  const at = state.cursor < WORD_LENGTH && state.draft[state.cursor] !== "" ? state.cursor : state.cursor - 1;
  if (at < 0) return state;
  const draft = [...state.draft];
  draft[at] = "";
  return { ...state, draft, cursor: at };
}

/** Clears the whole row being typed. */
export function clearDraft(state: TermoState): TermoState {
  if (isTermoLocked(state) || (state.cursor === 0 && state.draft.every((letter) => letter === ""))) return state;
  return { ...state, draft: EMPTY_DRAFT, cursor: 0 };
}

/** Moves the cursor to a position of the row. */
export function setCursor(state: TermoState, index: number): TermoState {
  if (isTermoLocked(state) || !Number.isInteger(index) || index < 0 || index >= WORD_LENGTH || index === state.cursor) return state;
  return { ...state, cursor: index };
}

/** Steps the cursor left or right. From past the end of a full row, a step left lands on the last letter. */
export function moveCursor(state: TermoState, delta: number): TermoState {
  return setCursor(state, Math.max(0, Math.min(WORD_LENGTH - 1, state.cursor + delta)));
}

export type GuessResult =
  | { ok: false; state: TermoState; error: GuessError | null }
  | {
      ok: true;
      state: TermoState;
      word: string;
      /** Boards this guess solved. */
      found: number[];
    };

/** Plays the row being typed on every board that is still open. An incomplete or unknown word is refused and the row stays. */
export function submitGuess(shape: TermoShape, state: TermoState): GuessResult {
  if (isTermoLocked(state)) return { ok: false, state, error: null };
  const error = checkGuess(state.draft, shape.language);
  if (error) return { ok: false, state, error };
  const word = state.draft.join("");
  const before = solvedBoards(shape, state.guesses);
  const guesses = [...state.guesses, word];
  const found = shape.answers.flatMap((answer, board) => (!before[board] && answer === word ? [board] : []));
  return { ok: true, word, found, state: { ...state, guesses, draft: EMPTY_DRAFT, cursor: 0, status: statusAfter(shape, guesses) } };
}

/** Positions of a board the player already knows: found by a guess in the right place, or given by a hint. */
export function knownPositions(shape: TermoShape, state: TermoState, board: number): boolean[] {
  const answer = shape.answers[board];
  const known: boolean[] = new Array(WORD_LENGTH).fill(false);
  for (const guess of state.guesses) scoreGuess(answer, guess).forEach((mark, index) => (known[index] ||= mark === "right"));
  for (const hint of state.hints) if (hint.board === board) known[hint.index] = true;
  return known;
}

/** The next letter a hint gives: the first unknown position of the first open board. Null when every open board is fully known. */
export function nextHint(shape: TermoShape, state: TermoState): TermoHint | null {
  if (isTermoLocked(state)) return null;
  const solved = solvedBoards(shape, state.guesses);
  for (let board = 0; board < shape.answers.length; board++) {
    if (solved[board]) continue;
    const index = knownPositions(shape, state, board).indexOf(false);
    if (index !== -1) return { board, index };
  }
  return null;
}

export function recordTermoHint(state: TermoState, hint: TermoHint): TermoState {
  return { ...state, hints: [...state.hints, hint] };
}

/** Letters hints gave away on a board that is still open, by position. Empty strings elsewhere. */
export function hintLetters(shape: TermoShape, state: TermoState, board: number): string[] {
  const letters: string[] = new Array(WORD_LENGTH).fill("");
  for (const hint of state.hints) if (hint.board === board) letters[hint.index] = shape.answers[board][hint.index];
  return letters;
}

/** The player gives up: the answers are shown and the game ends without a result that counts. */
export function revealTermo(state: TermoState): TermoState {
  return isTermoLocked(state) ? state : { ...state, revealed: true, draft: EMPTY_DRAFT, cursor: 0 };
}

export type TermoRow = {
  /** Letters as typed, plain. Empty strings on a row that has not been played. */
  letters: readonly string[];
  marks: readonly LetterMark[] | null;
  kind: "played" | "current" | "empty";
};

/**
 * Rows of one board. A solved board stops at the guess that found its word:
 * later guesses are not played on it, and its remaining rows stay empty.
 */
export function boardRows(shape: TermoShape, state: TermoState, board: number): TermoRow[] {
  const answer = shape.answers[board];
  const end = solvedAt(answer, state.guesses);
  const played = end === -1 ? state.guesses : state.guesses.slice(0, end + 1);
  const rows: TermoRow[] = played.map((guess) => ({ letters: [...guess], marks: scoreGuess(answer, guess), kind: "played" }));
  const open = end === -1 && !isTermoLocked(state);
  if (open && rows.length < shape.maxGuesses) rows.push({ letters: state.draft, marks: null, kind: "current" });
  while (rows.length < shape.maxGuesses) rows.push({ letters: EMPTY_DRAFT, marks: null, kind: "empty" });
  return rows;
}

/** Numbers for the result screen. A miss is a guess that did not find a word. */
export function termoScore(shape: TermoShape, state: TermoState): { moves: number; mistakes: number; hintsUsed: number } {
  return { moves: state.guesses.length, mistakes: state.guesses.length - countSolved(shape, state.guesses), hintsUsed: state.hints.length };
}
