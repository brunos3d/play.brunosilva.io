import { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";

export { DIFFICULTIES };
export type { Difficulty };

export type WendTier = {
  /** Board edges this tier draws from when the seed does not fix one. */
  sizes: readonly number[];
  /** How many words a board hides. */
  words: readonly [number, number];
  /** Shortest and longest word. */
  lengths: readonly [number, number];
  /** Walls: cells with no letter. */
  walls: readonly [number, number];
  /**
   * How far the word paths are scrambled, in path moves per cell. Near zero the
   * words run along the rows, back and forth, and about one word in four is a
   * straight line. From 2 up the paths are as winding as they get: about 0.4
   * corners per letter, and almost no straight word.
   */
  mixing: number;
  /** Whether the theme is on screen from the start. Off, it shows after the first word is found. */
  themeShown: boolean;
};

/**
 * LinkedIn's Sunday board is 7 by 7 with four walls and six words of 5 to 10
 * letters. That is the `hard` tier here. The other tiers scale the same recipe
 * down and up.
 */
export const WEND_TIERS: Record<Difficulty, WendTier> = {
  easy: { sizes: [5], words: [4, 5], lengths: [3, 7], walls: [0, 3], mixing: 0.05, themeShown: true },
  medium: { sizes: [6], words: [5, 6], lengths: [4, 9], walls: [0, 4], mixing: 0.5, themeShown: true },
  hard: { sizes: [7], words: [6, 7], lengths: [5, 10], walls: [1, 5], mixing: 3, themeShown: false },
  expert: { sizes: [7, 8], words: [6, 8], lengths: [5, 12], walls: [1, 6], mixing: 8, themeShown: false },
};

/** No trail can be longer than the longest word a board may hide. */
export const WEND_MAX_WORD = 12;
