/**
 * The board has no accents: "MAÇÃ" is laid out as M, A, C, A. The spelled form
 * comes back when the word is found.
 */
export function plainLetters(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

export const displayWord = (word: string): string => word.toUpperCase();
