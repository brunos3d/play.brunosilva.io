import type { Difficulty } from "@/shared/engine/difficulty";
import type { TermoLanguage } from "./words";

/**
 * What one letter of a guess says about the answer: it is in the right place,
 * it is in the word but somewhere else, or it is not in the word.
 */
export type LetterMark = "right" | "place" | "wrong";

/** What the game needs to be played: the hidden words, how many guesses there are and the language a guess must be a word of. Words are five plain letters, a to z. */
export type TermoShape = {
  /** One hidden word per board. Every guess is played on all of them. */
  answers: readonly string[];
  maxGuesses: number;
  /** The language of the hidden words. Its word list decides which guesses are accepted. */
  language: TermoLanguage;
};

export type TermoMetadata = {
  generatorVersion: number;
  shareSeed: string;
  /** How many answers the words were drawn from. */
  poolSize: number;
  /** Position of each word in the answer list. The list runs from the most common word down. */
  ranks: number[];
};

export type TermoPuzzle = TermoShape & {
  id: string;
  /** Canonical share seed, such as `TERMO:2026-11-23:1:easy`, or `TERMO:2026-11-23:1:easy:en` for English words. */
  seed: string;
  version: number;
  difficulty: Difficulty;
  metadata: TermoMetadata;
};
