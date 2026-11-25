import type { LetterMark } from "./types";
import { type TermoLanguage, WORD_LENGTH, isKnownWord } from "./words";

/**
 * Marks each letter of a guess against an answer. Both are plain five-letter
 * words. Repeated letters follow the usual rule: letters in the right place are
 * taken first, and a letter is only "in the word elsewhere" while the answer
 * still has an unmatched copy of it. Guessing "arara" against "carta" marks the
 * last A as right, the first A and the first R as elsewhere, and the other two
 * letters as wrong: "carta" has no third A and no second R.
 */
export function scoreGuess(answer: string, guess: string): LetterMark[] {
  const marks: LetterMark[] = new Array(WORD_LENGTH).fill("wrong");
  const left = new Map<string, number>();
  for (let index = 0; index < WORD_LENGTH; index++) {
    if (guess[index] === answer[index]) marks[index] = "right";
    else left.set(answer[index], (left.get(answer[index]) ?? 0) + 1);
  }
  for (let index = 0; index < WORD_LENGTH; index++) {
    if (marks[index] === "right") continue;
    const copies = left.get(guess[index]) ?? 0;
    if (copies > 0) {
      marks[index] = "place";
      left.set(guess[index], copies - 1);
    }
  }
  return marks;
}

export type GuessErrorCode = "incomplete" | "unknown";
/** Why a row was refused: a code, and the numbers its sentence needs. engine/text.ts turns it into words. */
export type GuessError = { code: GuessErrorCode; values?: Record<string, number> };

/** Checks a row before it is played. `letters` holds one entry per position, empty where nothing was typed. The word must be in the list of `language`. */
export function checkGuess(letters: readonly string[], language: TermoLanguage): GuessError | null {
  if (letters.length !== WORD_LENGTH || letters.some((letter) => !/^[a-z]$/.test(letter))) return { code: "incomplete", values: { length: WORD_LENGTH } };
  if (!isKnownWord(letters.join(""), language)) return { code: "unknown" };
  return null;
}

/** Index of the guess that found the answer, or -1. */
export function solvedAt(answer: string, guesses: readonly string[]): number {
  return guesses.indexOf(answer);
}

const RANK: Record<LetterMark, number> = { wrong: 0, place: 1, right: 2 };

/**
 * The best that is known about each letter on one board, for the keyboard. A
 * board stops learning once it is solved, because later guesses are not played
 * on it.
 */
export function letterStates(answer: string, guesses: readonly string[]): Map<string, LetterMark> {
  const states = new Map<string, LetterMark>();
  const end = solvedAt(answer, guesses);
  const played = end === -1 ? guesses : guesses.slice(0, end + 1);
  for (const guess of played) {
    const marks = scoreGuess(answer, guess);
    for (let index = 0; index < WORD_LENGTH; index++) {
      const current = states.get(guess[index]);
      if (current === undefined || RANK[marks[index]] > RANK[current]) states.set(guess[index], marks[index]);
    }
  }
  return states;
}
