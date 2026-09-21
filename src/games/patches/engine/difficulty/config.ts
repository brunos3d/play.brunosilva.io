import type { Difficulty } from "../types";

export type ClueMix = {
  /** Number and a real shape icon. */
  both: number;
  /** Number only. */
  areaOnly: number;
  /** Shape icon only. */
  shapeOnly: number;
  /** Neither: the player infers size and shape. */
  none: number;
};

export type TierConfig = {
  /** Board edge lengths the tier picks from when no size is requested. */
  sizes: readonly number[];
  /** Preferred patch area. Smaller patches mean more clues and longer chains. */
  meanArea: number;
  areaSpread: number;
  /** Starting information mix. The generator then tunes it toward the score band. */
  clueMix: ClueMix;
  /** Score band that defines the tier. Lower bound inclusive, upper bound exclusive for the next tier. */
  scoreBand: readonly [number, number];
  /**
   * Range the generator aims for. Each puzzle draws its own target from it, so
   * scores spread across the tier instead of bunching at the band's edge.
   */
  targetRange: readonly [number, number];
  /** Upper bound on patches that are forced on the empty board, as a share of all patches. */
  maxInitialForcedRatio: number;
  /** Patches that logic cannot reach. Kept at zero so every puzzle is fair. */
  maxGuesses: number;
};

/**
 * Tier settings. Sizes follow the boards seen in the original (5x5 to 8x8 in
 * the daily rotation). Bands were calibrated with `npm run patches:benchmark`.
 * Guessing is never allowed, so fair puzzles top out in the low 70s.
 */
export const TIER_CONFIG: Record<Difficulty, TierConfig> = {
  easy: {
    sizes: [5, 6],
    meanArea: 5,
    areaSpread: 2.5,
    clueMix: { both: 0.4, areaOnly: 0.5, shapeOnly: 0.1, none: 0 },
    scoreBand: [0, 28],
    targetRange: [10, 25],
    maxInitialForcedRatio: 0.85,
    maxGuesses: 0,
  },
  medium: {
    sizes: [6, 7],
    meanArea: 4.8,
    areaSpread: 2.5,
    clueMix: { both: 0.25, areaOnly: 0.45, shapeOnly: 0.2, none: 0.1 },
    scoreBand: [28, 45],
    targetRange: [31, 42],
    maxInitialForcedRatio: 0.6,
    maxGuesses: 0,
  },
  hard: {
    sizes: [7, 8],
    meanArea: 4.4,
    areaSpread: 2.3,
    clueMix: { both: 0.15, areaOnly: 0.4, shapeOnly: 0.25, none: 0.2 },
    scoreBand: [45, 60],
    targetRange: [48, 57],
    maxInitialForcedRatio: 0.45,
    maxGuesses: 0,
  },
  expert: {
    sizes: [7, 8],
    meanArea: 4,
    areaSpread: 2.2,
    clueMix: { both: 0.1, areaOnly: 0.3, shapeOnly: 0.3, none: 0.3 },
    scoreBand: [60, 100],
    targetRange: [63, 72],
    maxInitialForcedRatio: 0.35,
    maxGuesses: 0,
  },
};

export function tierForScore(score: number): Difficulty {
  if (score < TIER_CONFIG.medium.scoreBand[0]) return "easy";
  if (score < TIER_CONFIG.hard.scoreBand[0]) return "medium";
  if (score < TIER_CONFIG.expert.scoreBand[0]) return "hard";
  return "expert";
}
