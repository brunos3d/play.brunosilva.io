/**
 * Domain types for the Patches engine. Nothing here depends on React, the DOM
 * or storage, so the same puzzle runs in a browser, a worker, a CLI or a test.
 */

import type { Difficulty } from "@/shared/engine/difficulty";

export { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";

/**
 * `freeform` and `unconstrained` accept the same rectangles. `freeform` shows
 * the dashed "any shape" icon, `unconstrained` shows no icon at all.
 */
export const SHAPE_CONSTRAINTS = ["square", "tall", "wide", "freeform", "unconstrained"] as const;
export type ShapeConstraint = (typeof SHAPE_CONSTRAINTS)[number];

/** Shape derived from a cell set. `irregular` means the cells are not a filled rectangle. */
export type RegionShape = "square" | "tall" | "wide" | "irregular";

export type CellCoordinate = { row: number; column: number };

/** Axis-aligned rectangle addressed by its top-left cell. */
export type Rect = { row: number; column: number; width: number; height: number };

export type Clue = {
  id: string;
  row: number;
  column: number;
  /** Exact number of cells. Missing means the player must infer the size. */
  area?: number;
  /** Missing is the same as `unconstrained`. */
  shape?: ShapeConstraint;
};

export type Region = {
  id: string;
  clueId: string;
  cells: CellCoordinate[];
  area: number;
  width: number;
  height: number;
  shape: RegionShape;
};

export type QualityMetrics = {
  solutionCount: number;
  /** Total candidate rectangles over all clues before any deduction. */
  candidateCount: number;
  averageCandidateCount: number;
  /** Patches that are forced before anything is placed. */
  forcedMoveCount: number;
  /** Largest number of options at the most constrained cell during search. */
  maximumBranchingFactor: number;
  /** Rounds of deduction needed when every forced patch is placed at once. */
  deductionDepth: number;
  /** Patches that needed candidate elimination before they became forced. */
  advancedStepCount: number;
  /** Patches that pure logic could not reach. */
  guessCount: number;
  clueDensity: number;
  /** Share of clues without a number. */
  unknownClueRatio: number;
  solverNodes: number;
};

export type PuzzleMetadata = {
  generatorVersion: number;
  /** Canonical, shareable seed string. */
  shareSeed: string;
  difficultyScore: number;
  /** Tier the score falls into. Can differ from the requested tier on rare fallbacks. */
  measuredDifficulty: Difficulty;
  metrics: QualityMetrics;
  /** Generation attempts used, 1-based. */
  attempts: number;
};

export type Puzzle = {
  id: string;
  seed: string;
  version: number;
  width: number;
  height: number;
  difficulty: Difficulty;
  clues: Clue[];
  solution: Region[];
  metadata: PuzzleMetadata;
};

/** The parts of a puzzle the rules need. Lets tests and tools build boards by hand. */
export type PuzzleShape = Pick<Puzzle, "width" | "height" | "clues">;
