import { LEGACY_WORD_LANGUAGE } from "@/i18n/game-language";
import { type Clock, restoreClock } from "@/shared/engine/clock";
import { type TermoHint, type TermoState, createTermoGame, statusAfter } from "../engine/game/state";
import type { TermoShape } from "../engine/types";
import { type TermoLanguage, WORD_LENGTH, isKnownWord } from "../engine/words";

const SNAPSHOT_VERSION = 1;

/** What goes to disk for one Termo game. The marks are not stored: they follow from the hidden words and the guesses. */
export type TermoSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  /** Language of the words. Boards saved before the game had two languages do not have it, and are Portuguese. */
  language?: TermoLanguage;
  guesses: string[];
  /** The row being typed, one entry per position. */
  draft: string[];
  cursor: number;
  /** Each hint as [board, position]. */
  hints: [number, number][];
  revealed: boolean;
  startedAt: number | null;
  finishedMs: number | null;
};

export function toTermoSnapshot(state: TermoState, puzzle: { seed: string; language: TermoLanguage }, clock: Clock): TermoSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed: puzzle.seed,
    language: puzzle.language,
    guesses: [...state.guesses],
    draft: [...state.draft],
    cursor: state.cursor,
    hints: state.hints.map((hint) => [hint.board, hint.index]),
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isLetter = (value: unknown): value is string => typeof value === "string" && /^[a-z]?$/.test(value);

/**
 * Rebuilds a game from disk. Stored data is untrusted: the board must be in
 * the puzzle's language, every guess must be a word that language accepts, the
 * guesses must stop where the game would have ended, hints must point at real
 * positions, and the status is worked out again from the guesses. A finished
 * game must carry a final time and an unfinished one must not. Anything off
 * returns null, and the caller starts a fresh game.
 *
 * The word list of `shape.language` must be loaded.
 */
export function fromTermoSnapshot(puzzleId: string, shape: TermoShape, snapshot: unknown): { state: TermoState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<TermoSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
  if ((data.language ?? LEGACY_WORD_LANGUAGE) !== shape.language) return null;
  if (!Array.isArray(data.guesses) || data.guesses.length > shape.maxGuesses) return null;
  if (!data.guesses.every((guess) => typeof guess === "string" && guess.length === WORD_LENGTH && isKnownWord(guess, shape.language))) return null;
  // No guess can follow the one that ended the game.
  for (let count = 0; count < data.guesses.length; count++) if (statusAfter(shape, data.guesses.slice(0, count)) !== "playing") return null;

  if (!Array.isArray(data.hints)) return null;
  const hints: TermoHint[] = [];
  for (const entry of data.hints) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isCount(entry[0]) || !isCount(entry[1])) return null;
    const [board, index] = entry;
    if (board >= shape.answers.length || index >= WORD_LENGTH || hints.some((hint) => hint.board === board && hint.index === index)) return null;
    hints.push({ board, index });
  }

  const status = statusAfter(shape, data.guesses);
  const revealed = data.revealed === true;
  const ended = status !== "playing" || revealed;
  const clock = restoreClock(data.startedAt, data.finishedMs);
  if (ended !== (clock.finishedMs !== null)) return null;

  const state: TermoState = { ...createTermoGame(puzzleId), guesses: data.guesses, hints, status, revealed };
  if (ended) return { clock, state };
  if (!Array.isArray(data.draft) || data.draft.length !== WORD_LENGTH || !data.draft.every(isLetter)) return { clock, state };
  const cursor = isCount(data.cursor) && data.cursor <= WORD_LENGTH ? data.cursor : 0;
  return { clock, state: { ...state, draft: data.draft, cursor } };
}
