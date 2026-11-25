import type { Translate } from "@/i18n/translate";

/*
 * Two kinds of text live here, and they follow two different languages.
 *
 * The letters of the words follow the game language: the language of the word
 * bank a puzzle was built from. `plainLetters` and `displayWord` turn a bank
 * entry into what the board and the word list show.
 *
 * The sentences follow the interface locale. The rules return data (a word, a
 * count, what a hint did) and the functions below build the sentence with a
 * translator for the "wend" namespace (messages/<locale>/wend.json). So a
 * player can read "2 words to go." under a board of Portuguese words.
 */

/**
 * The board has no accents: "MAÇÃ" is laid out as M, A, C, A. The spelled form
 * comes back when the word is found. English words have no accents to lose,
 * and go through here all the same, so every bank is read in one way.
 */
export function plainLetters(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export const displayWord = (word: string): string => word.toUpperCase();

/** A list of word lengths as a phrase: "5", "5 and 6", "5, 6 and 7". */
export function lengthsText(t: Translate, lengths: readonly number[]): string {
  if (lengths.length <= 1) return lengths.join("");
  return t("lengths.joined", { rest: lengths.slice(0, -1).join(t("lengths.separator")), last: lengths[lengths.length - 1] });
}

/**
 * What the status line says while nothing else is being said: the task at the
 * start, then how many words are left. `lengths` holds the length of every
 * hidden word, found or not.
 */
export function idleText(t: Translate, lengths: readonly number[], remaining: number): string {
  if (remaining >= lengths.length) return t("idle.start", { count: lengths.length, lengths: lengthsText(t, lengths) });
  return t("idle.left", { count: remaining });
}

/** A word was found. `remaining` counts the words still hidden. */
export function foundText(t: Translate, word: string, remaining: number): string {
  return remaining === 0 ? t("status.foundLast", { word }) : t("status.found", { word, count: remaining });
}

/** A trail spells a hidden word, but over cells the word does not use. */
export function elsewhereText(t: Translate, letters: string): string {
  return t("status.elsewhere", { word: letters });
}

/** The last sentence of a game: solved, or given up. */
export function endText(t: Translate, revealed: boolean): string {
  return t(revealed ? "status.revealed" : "status.solved");
}

/**
 * What a hint did. `hint` is the engine's `HintStep`, or the part of it the
 * sentence needs, and `word` is the hidden word it worked on, as it is spelled.
 * The word is only named once the hint has completed it.
 */
export function hintText(t: Translate, hint: { cleared: number; first: boolean; found: boolean }, word: string): string {
  const revealed = hint.found ? t("hint.last", { word }) : t(hint.first ? "hint.first" : "hint.next");
  return hint.cleared > 0 ? t("hint.fixed", { count: hint.cleared, revealed }) : revealed;
}
