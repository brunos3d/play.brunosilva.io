import type { Difficulty } from "@/shared/engine/difficulty";

export type SumbreakTier = {
  /** Board edge lengths the tier picks from when no size is requested. */
  sizes: readonly number[];
  /**
   * The last tile is 2 to this power, [min, max], per board size. LinkedIn's
   * boards end on 128 for 3x3 and 1024 for 4x4. A lower power means more small
   * equal tiles for the same board.
   */
  exponent: Record<number, readonly [number, number]>;
  /** Which tiles the backward builder likes to break, [min, max]. See generator/v1.ts. */
  spread: readonly [number, number];
  /** The win chance the tier aims for, as measured by `SumbreakSolver.winChance`. */
  winChance: number;
  /** A candidate this close to the target, in natural-log units, is taken at once. */
  tolerance: number;
  /** Boards measured per puzzle before the closest one is kept. */
  candidates: number;
};

const EXPONENTS: Record<number, readonly [number, number]> = { 3: [4, 8], 4: [8, 10], 5: [10, 12] };

export const SUMBREAK_TIERS: Record<Difficulty, SumbreakTier> = {
  easy: { sizes: [3], exponent: EXPONENTS, spread: [0.4, 1], winChance: 0.55, tolerance: 0.25, candidates: 12 },
  medium: { sizes: [3, 4], exponent: EXPONENTS, spread: [0.2, 1], winChance: 0.17, tolerance: 0.3, candidates: 16 },
  hard: { sizes: [4], exponent: EXPONENTS, spread: [0, 1], winChance: 0.045, tolerance: 0.35, candidates: 20 },
  expert: { sizes: [4, 5], exponent: EXPONENTS, spread: [0, 0.8], winChance: 0.012, tolerance: 0.5, candidates: 16 },
};
