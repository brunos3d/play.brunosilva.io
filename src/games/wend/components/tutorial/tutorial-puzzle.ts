import { type GameLanguage, LEGACY_WORD_LANGUAGE } from "@/i18n/game-language";
import { displayWord, plainLetters } from "../../engine/text";
import type { PlayableWend } from "../../hooks/use-wend-game";

/** The tutorial's board and the title of its theme, both in one game language. */
export type WendTutorial = { puzzle: PlayableWend; theme: string };

/**
 * The tutorial plays on a fixed 3x3 board with two walls: a fruit of three
 * letters along the top row and a fruit of four around the corner. Every game
 * language has its own two fruits on that same shape:
 *
 *   U V A      F I G
 *   # O G      # R A
 *   # F I      # P E
 *
 * UVA and FIGO in Portuguese, FIG and PEAR in English. The steps of the
 * tutorial take the words and their first letters from the board, so their
 * sentences can be in another language than the words.
 */
const SHORT_PATH = [0, 1, 2] as const;
const LONG_PATH = [7, 8, 5, 4] as const;

function tutorial(id: string, seed: string, theme: string, short: string, long: string): WendTutorial {
  const letters = new Array<string>(9).fill("");
  const words = [
    { word: short, path: SHORT_PATH },
    { word: long, path: LONG_PATH },
  ].map(({ word, path }) => {
    const text = plainLetters(word);
    if (text.length !== path.length) throw new RangeError(`${word} does not fit its place on the tutorial board.`);
    path.forEach((cell, index) => (letters[cell] = text[index]));
    return { text, display: displayWord(word), path: [...path] };
  });
  return { puzzle: { id, seed, size: 3, letters, words }, theme };
}

export const WEND_TUTORIALS: Record<GameLanguage, WendTutorial> = {
  "pt-br": tutorial("wend-tutorial", "WEND:tutorial:1:easy", "Frutas", "uva", "figo"),
  en: tutorial("wend-tutorial-en", "WEND:tutorial:1:easy:en", "Fruits", "fig", "pear"),
};

/** The tutorial in a game language. An unknown language gets the Portuguese one, as a seed without a language does. */
export const wendTutorial = (language: GameLanguage): WendTutorial => WEND_TUTORIALS[language] ?? WEND_TUTORIALS[LEGACY_WORD_LANGUAGE];

/** The Portuguese tutorial board, the one the game shipped with. */
export const WEND_TUTORIAL_PUZZLE: PlayableWend = WEND_TUTORIALS[LEGACY_WORD_LANGUAGE].puzzle;
