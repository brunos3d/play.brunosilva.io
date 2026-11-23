import { ACCENTED } from "./words/accents";
import { ANSWERS, EASY_ANSWER_COUNT } from "./words/answers";
import { GUESSES } from "./words/guesses";

/**
 * The word lists, read from the generated modules in ./words. They ship as
 * long strings and are cut up on first use, so loading the game costs one
 * string each and no parsing of ten thousand array items.
 *
 * Every word is handled in its plain form: lower case, five letters a to z, no
 * accents and no cedilla. "maçã" is typed, stored and compared as "maca". The
 * accented spelling only comes back when a word is shown.
 */
export const WORD_LENGTH = 5;

/** Strips accents and the cedilla and lowers the case. Anything that is not a letter is dropped. */
export function plainLetters(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const chunk = (text: string): string[] => {
  const words: string[] = [];
  for (let index = 0; index + WORD_LENGTH <= text.length; index += WORD_LENGTH) words.push(text.slice(index, index + WORD_LENGTH));
  return words;
};

let answerList: readonly string[] | null = null;
let known: Set<string> | null = null;
let accents: Map<string, string> | null = null;

/** Every answer, from the most common word down. */
export function answerWords(): readonly string[] {
  answerList ??= chunk(ANSWERS);
  return answerList;
}

/** How many answers, counted from the most common, the easy tier draws from. */
export const EASY_POOL_SIZE = EASY_ANSWER_COUNT;

/** True for a word the game takes as a guess. Expects the plain form. */
export function isKnownWord(word: string): boolean {
  known ??= new Set([...answerWords(), ...chunk(GUESSES)]);
  return known.has(word);
}

export function knownWordCount(): number {
  isKnownWord("");
  return known!.size;
}

/** The word as it is written, with its accents: "maca" comes back as "maçã". Unknown words come back unchanged. */
export function displayWord(word: string): string {
  if (!accents) {
    accents = new Map();
    for (const spelled of ACCENTED.split(" ")) accents.set(plainLetters(spelled), spelled);
  }
  return accents.get(word) ?? word;
}
