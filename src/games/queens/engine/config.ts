import type { Difficulty } from "@/shared/engine/difficulty";

/** Tier settings of generator version 1. */
export type QueensTier = {
  /** Board edge lengths the tier picks from when no size is requested. */
  sizes: readonly number[];
  /** Boards within `maxLevel` the generator wants to choose from. It keeps the one whose score is closest to the target. */
  candidates: number;
  /** Hardest technique the tier wants a board to need. A board above it is only kept when nothing else was built. */
  maxLevel: number;
  /** Easiest "hardest technique" the tier is happy with. Boards below it lose to boards that reach it. */
  minLevel: number;
  /**
   * Deduction score the tier aims for, per row of the board, so a 10x10 aims
   * higher than a 7x7. The score is the weighted sum of the deduction steps
   * (see LEVEL_WEIGHTS in solver/logic.ts). Infinity means "the hardest candidate".
   */
  targetScorePerRow: number;
  /** Smallest region the tier accepts. One-cell regions give a queen away. */
  minRegionSize: number;
  /**
   * How unevenly regions grow, [min, max]. Each region draws an appetite in
   * this range and grows in proportion to it. A wide range mixes small regions
   * with large ones, which makes the first steps easy to find.
   */
  appetite: readonly [number, number];
};

export const QUEENS_TIERS: Record<Difficulty, QueensTier> = {
  easy: { sizes: [5, 6], candidates: 3, maxLevel: 2, minLevel: 1, targetScorePerRow: 0.3, minRegionSize: 1, appetite: [0.3, 3] },
  medium: { sizes: [7], candidates: 4, maxLevel: 3, minLevel: 2, targetScorePerRow: 1, minRegionSize: 1, appetite: [0.4, 2.5] },
  hard: { sizes: [8, 9], candidates: 4, maxLevel: 4, minLevel: 3, targetScorePerRow: 2.2, minRegionSize: 2, appetite: [0.5, 2] },
  expert: { sizes: [9, 10], candidates: 5, maxLevel: 5, minLevel: 4, targetScorePerRow: Number.POSITIVE_INFINITY, minRegionSize: 2, appetite: [0.6, 1.8] },
};
