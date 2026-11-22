import type { Difficulty } from "@/shared/engine/difficulty";

export { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";

/** The parts of a puzzle the rules need: the edge length and the region of every cell, row-major. Lets tests and the tutorial build boards by hand. */
export type QueensShape = { size: number; regions: readonly number[] };

/** Deduction techniques, easiest first. See solver/logic.ts. */
export type Technique =
  /** A region, row or column has one free cell left. */
  | "single"
  /** Every free cell of a region is in one row or column. */
  | "confined-region"
  /** Every free cell of a row or column is in one region. */
  | "confined-line"
  /** A queen on this cell would leave a region, row or column without a free cell. */
  | "blocker"
  /** N regions fit entirely inside N rows or columns. */
  | "region-group"
  /** N rows or columns only have free cells in N regions. */
  | "line-group"
  /** A queen on this cell forces a chain of queens that leaves a region, row or column without a free cell. */
  | "trial";

export type QueensMetadata = {
  generatorVersion: number;
  shareSeed: string;
  /** Generation attempts used, 1-based. */
  attempts: number;
  /** Nodes the generator's search visited to keep the solution unique while the regions grew. */
  solverNodes: number;
  /** Steps the deduction solver needed. */
  steps: number;
  /** Hardest technique the deduction solver needed, 1 to 6. */
  maxLevel: number;
  /** Weighted sum of the deduction steps. Tiers aim for a score. See config.ts. */
  score: number;
  /** Steps per level, index 0 is level 1. */
  levels: number[];
  /** Cells per region, by region id. */
  regionSizes: number[];
};

export type QueensPuzzle = QueensShape & {
  id: string;
  seed: string;
  version: number;
  difficulty: Difficulty;
  regions: number[];
  /** The one solution: the queen's cell in each row, as row-major indices, top row first. */
  solution: number[];
  metadata: QueensMetadata;
};
