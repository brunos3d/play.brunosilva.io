import type { Translate } from "@/i18n/translate";
import type { Difficulty } from "@/shared/engine/difficulty";
import { TERMO_TIERS } from "./config";
import { type TermoHint, type TermoState, countSolved } from "./game/state";
import type { GuessError } from "./rules";
import type { LetterMark, TermoShape } from "./types";
import { type TermoLanguage, WORD_LENGTH, displayWord } from "./words";

/**
 * Every sentence the Termo engine has to say, built from the engine's data and
 * a translator for the "termo" namespace (messages/<locale>/termo.json). The
 * rules and the game state return codes and values only, so the engine speaks
 * whatever language the translator does.
 *
 * Two languages meet here and they are independent. The sentences are in the
 * interface locale, which is the translator's. The words inside them (a hidden
 * word, a guess) are in the game language, which is the puzzle's.
 */

/** A word as the status line writes it: with its accents and in capitals. "aviao" is AVIÃO. */
export const shownWord = (word: string, language: TermoLanguage): string => displayWord(word, language).toUpperCase();

/** "A", "A and B", "A, B, C and D". */
export function wordListText(t: Translate, words: readonly string[]): string {
  return words.length === 1 ? words[0] : t("list", { head: words.slice(0, -1).join(", "), last: words[words.length - 1] });
}

/** Why a row was refused. */
export function guessErrorText(t: Translate, error: GuessError): string {
  return t(`error.${error.code}`, error.values);
}

/** What the status line says while nothing else is being said: how to start, then which guess comes next. */
export function idleText(t: Translate, shape: TermoShape, state: TermoState): string {
  if (state.guesses.length === 0) return t("idle.start", { count: shape.answers.length, guesses: shape.maxGuesses, length: WORD_LENGTH });
  return t("idle.progress", { number: Math.min(state.guesses.length + 1, shape.maxGuesses), total: shape.maxGuesses });
}

/** What the status line says once a game is over: won, revealed, or out of guesses. */
export function endText(t: Translate, shape: TermoShape, state: TermoState): string {
  const words = shape.answers.length;
  if (state.status === "solved") {
    const count = state.guesses.length;
    return words > 1 ? t("status.solvedAll", { words, count }) : t("status.solved", { count });
  }
  const answers = wordListText(
    t,
    shape.answers.map((word) => shownWord(word, shape.language)),
  );
  return t(state.revealed ? "status.revealed" : "status.lost", { words, answers });
}

/** A guess found one of several words and the game goes on. `state` is the game after that guess. */
export function foundText(t: Translate, shape: TermoShape, state: TermoState, word: string): string {
  return t("status.found", { word: shownWord(word, shape.language), left: shape.answers.length - countSolved(shape, state.guesses) });
}

/** The letter a hint gave away, or that there is none left to give. */
export function hintText(t: Translate, shape: TermoShape, hint: TermoHint | null): string {
  if (!hint) return t("hint.none");
  const values = { position: hint.index + 1, letter: shape.answers[hint.board][hint.index].toUpperCase() };
  return shape.answers.length > 1 ? t("hint.letterOnBoard", { ...values, board: hint.board + 1 }) : t("hint.letter", values);
}

/** What a mark means, for a screen reader: "in the right place". */
export function markText(t: Translate, mark: LetterMark): string {
  return t(`mark.${mark}`);
}

/** The label of the whole board, for a screen reader. */
export function boardLabelText(t: Translate, shape: TermoShape): string {
  return t("board.label", { count: shape.answers.length, guesses: shape.maxGuesses, length: WORD_LENGTH });
}

/** What a mode is: "2 words at once, 7 guesses". */
export function modeSummaryText(t: Translate, difficulty: Difficulty): string {
  const tier = TERMO_TIERS[difficulty];
  return t("practice.summary", { boards: tier.boards, guesses: tier.maxGuesses });
}
