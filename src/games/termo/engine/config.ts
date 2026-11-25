import type { GameLanguage } from "@/i18n/game-language";
import { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";
import type { LetterMark } from "./types";

export { DIFFICULTIES };
export type { Difficulty };

export type TermoTier = {
  /** Hidden words, one per board. */
  boards: number;
  maxGuesses: number;
  /** "common" draws from the most common answers only. "all" draws from the whole answer list. */
  pool: "common" | "all";
};

/**
 * The ladder follows term.ooo: one word in six guesses, then Dueto (two words,
 * seven guesses) and Quarteto (four words, nine guesses). Easy and medium are
 * both the one-word game. They differ in how common the hidden word is.
 */
export const TERMO_TIERS: Record<Difficulty, TermoTier> = {
  easy: { boards: 1, maxGuesses: 6, pool: "common" },
  medium: { boards: 1, maxGuesses: 6, pool: "all" },
  hard: { boards: 2, maxGuesses: 7, pool: "all" },
  expert: { boards: 4, maxGuesses: 9, pool: "all" },
};

/**
 * What the player picks is a mode, named as on term.ooo, and not a difficulty:
 * Termo is one word, Dueto is two at once and Quarteto is four at once. Seeds
 * keep the platform's four tiers, so each mode maps to one of them. "easy" is
 * also Termo: the daily uses it early in the week, with the more common words.
 */
export type TermoMode = { name: string; difficulty: Difficulty; summary: string };

export const TERMO_MODES: readonly TermoMode[] = [
  { name: "Termo", difficulty: "medium", summary: "1 word, 6 guesses" },
  { name: "Dueto", difficulty: "hard", summary: "2 words at once, 7 guesses" },
  { name: "Quarteto", difficulty: "expert", summary: "4 words at once, 9 guesses" },
];

/** Name shown for a tier wherever the platform would say "easy" or "expert". */
export const TERMO_MODE_NAMES: Record<Difficulty, string> = { easy: "Termo", medium: "Termo", hard: "Dueto", expert: "Quarteto" };

/**
 * The tutorial shows three words, each with one letter marked. They are words
 * of the game language, so each language has its own three, written in the
 * plain form. The sentences next to them are interface text and live in the
 * messages.
 */
export type TermoExample = { word: string; at: number; mark: LetterMark };

export const TERMO_EXAMPLES: Record<GameLanguage, readonly TermoExample[]> = {
  "pt-br": [
    { word: "festa", at: 0, mark: "right" },
    { word: "campo", at: 2, mark: "place" },
    { word: "nuvem", at: 3, mark: "wrong" },
  ],
  en: [
    { word: "plant", at: 0, mark: "right" },
    { word: "house", at: 2, mark: "place" },
    { word: "money", at: 3, mark: "wrong" },
  ],
};
