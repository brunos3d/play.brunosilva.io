import type { Difficulty } from "@/shared/engine/difficulty";

/** A hidden word and the cells it runs through, in reading order. */
export type WendWord = {
  /** Plain capitals, A to Z. This is what the board shows, one letter per cell. */
  text: string;
  /** The word as it is spelled, with its accents, in capitals. Shown once the word is found. */
  display: string;
  path: readonly number[];
};

/** What the rules need to know about a board. */
export type WendShape = {
  size: number;
  /** One entry per cell, row by row. A letter, or "" for a wall. */
  letters: readonly string[];
  /** Sorted by length, shortest first. The word list on screen uses this order. */
  words: readonly WendWord[];
};

export type WendPuzzle = WendShape & {
  id: string;
  /** Canonical seed. It rebuilds this exact puzzle. */
  seed: string;
  version: number;
  difficulty: Difficulty;
  /** What the hidden words have in common. */
  theme: string;
  /** False on the harder tiers: the theme then shows only after the first word is found. */
  themeShown: boolean;
  metadata: {
    generatorVersion: number;
    shareSeed: string;
    /** Boards built before one with a single solution came up. */
    attempts: number;
    /** Work the uniqueness check did on the accepted board. */
    solverNodes: number;
    walls: number;
    /** Corners per letter over all word paths. 0 is a word search, higher is more winding. */
    bendiness: number;
  };
};
