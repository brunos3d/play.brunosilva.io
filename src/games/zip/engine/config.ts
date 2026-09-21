import type { Difficulty } from "@/shared/engine/difficulty";
import type { FigureName } from "./generator/figures";
import type { DrawnStyle } from "./generator/paths";

/**
 * Tier settings of generator version 2. Version 1 keeps its own frozen copy in
 * generator/v1.ts.
 */
export type ZipTier = {
  /** Board edge lengths the tier picks from when no size is requested. */
  sizes: readonly number[];
  /** Numbered cells the board starts with, as a share of all cells, [min, max]. */
  checkpointDensity: readonly [number, number];
  /** How uneven the stretches between numbers are. 0 is evenly spaced, 1 mixes very short and very long stretches. */
  gapVariance: number;
  /**
   * How an ambiguous board is made unique. "walls" blocks an edge of each wrong
   * solution. "numbers-first" prefers a new number where the wrong solution
   * takes cells in a different order, up to `maxCheckpointDensity`, and falls
   * back to walls. Numbers halve the wall count, which keeps the theme readable.
   */
  uniqueness: "walls" | "numbers-first";
  maxCheckpointDensity: number;
  /** Backbite moves per cell applied to a drawn path. Each move changes one edge of the drawing. */
  perturbation: readonly [number, number];
  /** Upper bound on walls added for uniqueness, on top of the figure, as a share of all cells. */
  maxExtraWallShare: number;
  /** Boards built per puzzle. The generator keeps the one whose trap score is closest to `targetTraps`. */
  candidates: number;
  /**
   * The trap score the tier aims for (see generator/difficulty.ts). Themes vary
   * a lot, so without a target a medium spiral could outscore a hard board.
   * Infinity means "the hardest candidate".
   */
  targetTraps: number;
  /**
   * Share of the numbers between 1 and the last one that show "?" instead,
   * [min, max]. A number is only hidden while the board stays uniquely
   * solvable, so the real share can end up lower.
   */
  hiddenNumbers: readonly [number, number];
  /**
   * Relative odds of each wall figure. "none" means a drawn path carries the
   * theme instead. The odds follow measurements on 8x8 boards: corridors and
   * the pinwheel force almost the whole path (median trap score 1 and 6), so
   * they belong to the easy tiers, while a lightly disturbed snake or spiral on
   * an open board is the hardest kind (median 89 and 52, against 23 for the
   * shuffled path of version 1).
   */
  figureOdds: Partial<Record<FigureName, number>>;
  pathOdds: Record<DrawnStyle, number>;
  /**
   * Chance that the solution is symmetric: its second half is the mirror image
   * or the half turn of the first. Only boards whose walls and blocked cells
   * are symmetric themselves can have one.
   */
  symmetricOdds: number;
  /**
   * Chance that a board trades numbers for walls: it starts with fewer numbers
   * and is made unique with walls alone. The seed decides, so one tier offers
   * both kinds of board.
   */
  wallsFirstOdds: number;
};

export const MIN_CHECKPOINTS = 3;

export const ZIP_TIERS: Record<Difficulty, ZipTier> = {
  easy: {
    sizes: [5, 6],
    checkpointDensity: [0.16, 0.22],
    gapVariance: 0.2,
    uniqueness: "numbers-first",
    maxCheckpointDensity: 0.3,
    perturbation: [0.05, 0.12],
    maxExtraWallShare: 0.28,
    candidates: 2,
    targetTraps: 0,
    hiddenNumbers: [0, 0],
    figureOdds: { none: 2, corridors: 3, pinwheel: 2, cross: 2, face: 2, corners: 1, slash: 1, frame: 1, mirror: 1, core: 1.5, pillars: 1.5, islands: 1 },
    pathOdds: { hilbert: 2, spiral: 1, snake: 1, random: 1 },
    symmetricOdds: 0.3,
    wallsFirstOdds: 0.25,
  },
  medium: {
    sizes: [6, 7],
    checkpointDensity: [0.12, 0.16],
    gapVariance: 0.45,
    uniqueness: "numbers-first",
    maxCheckpointDensity: 0.25,
    perturbation: [0.1, 0.22],
    maxExtraWallShare: 0.28,
    candidates: 3,
    targetTraps: 14,
    hiddenNumbers: [0, 0],
    figureOdds: { none: 3, cross: 2, face: 2, corners: 2, slash: 2, frame: 2, mirror: 2, core: 1.5, pillars: 2, islands: 2 },
    pathOdds: { hilbert: 1, spiral: 1, snake: 1, random: 1 },
    symmetricOdds: 0.3,
    wallsFirstOdds: 0.3,
  },
  hard: {
    sizes: [7, 8],
    checkpointDensity: [0.085, 0.115],
    gapVariance: 0.7,
    uniqueness: "numbers-first",
    maxCheckpointDensity: 0.2,
    perturbation: [0.15, 0.32],
    maxExtraWallShare: 0.26,
    candidates: 3,
    targetTraps: 28,
    hiddenNumbers: [0.25, 0.4],
    figureOdds: { none: 5, cross: 1, face: 1.5, corners: 1.5, slash: 2, frame: 2, mirror: 2, core: 1.5, pillars: 2, islands: 2.5 },
    pathOdds: { hilbert: 1.5, spiral: 2, snake: 2, random: 1 },
    symmetricOdds: 0.3,
    wallsFirstOdds: 0.3,
  },
  expert: {
    sizes: [7, 8],
    checkpointDensity: [0.065, 0.09],
    gapVariance: 0.9,
    uniqueness: "numbers-first",
    maxCheckpointDensity: 0.21,
    perturbation: [0.2, 0.42],
    maxExtraWallShare: 0.24,
    candidates: 5,
    targetTraps: Number.POSITIVE_INFINITY,
    hiddenNumbers: [0.4, 0.6],
    figureOdds: { none: 7, face: 1, corners: 1, frame: 1.5, slash: 2, mirror: 2, core: 1.5, pillars: 2, islands: 2.5 },
    pathOdds: { hilbert: 1, spiral: 3, snake: 3, random: 1 },
    symmetricOdds: 0.3,
    wallsFirstOdds: 0.3,
  },
};
