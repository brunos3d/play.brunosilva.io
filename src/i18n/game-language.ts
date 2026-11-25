import { type Locale, isLocale } from "./config";

/**
 * The language a game is played in. It is a setting of its own, apart from the
 * interface locale: the words of Termo and Wend and the voice of the chess
 * coach follow it. A player can read the interface in English and play in
 * Portuguese, or the other way around.
 *
 * The codes are the locale codes, so "follow the interface" needs no mapping.
 */
export type GameLanguage = Locale;

export const isGameLanguage = (value: unknown): value is GameLanguage => isLocale(value);

/**
 * Termo and Wend shipped in Portuguese only, and their seeds carried no
 * language. A seed without one still means Portuguese, so every link shared
 * before the games had two languages opens the puzzle it always opened.
 */
export const LEGACY_WORD_LANGUAGE: GameLanguage = "pt-br";

/** The game language in effect: what the player picked, or the interface locale until they pick. */
export function effectiveGameLanguage(choice: GameLanguage | null | undefined, locale: Locale): GameLanguage {
  return choice ?? locale;
}
