import type { Difficulty } from "@/shared/engine/difficulty";

export { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";

export type CellCoordinate = { row: number; column: number };

/**
 * A numbered cell. The path must pass them in order: 1, 2, 3 and so on. A
 * hidden one shows "?" instead of its number: the player knows the cell is
 * numbered, but not where it falls in the order. 1 and the last number are
 * never hidden.
 */
export type Checkpoint = { number: number; row: number; column: number; hidden?: boolean };

/** A wall between two orthogonally adjacent cells, stored as cell indices with a < b. */
export type Wall = { a: number; b: number };

export type ZipMetadata = {
  generatorVersion: number;
  shareSeed: string;
  /** Generation attempts used, 1-based. */
  attempts: number;
  /** Nodes the solver visited to prove the solution unique. */
  solverNodes: number;
  wallCount: number;
  checkpointCount: number;
  /** Numbers that show "?" instead of their value. */
  hiddenCount: number;
  /** What the board was built around: a wall figure, a drawn path, or both "none" and "random" for version 1. */
  theme: { figure: string; path: string };
  /** Weighted count of wrong turns that stay hidden for a while. See generator/difficulty.ts. */
  trapScore: number;
  deepTraps: number;
};

export type ZipPuzzle = {
  id: string;
  seed: string;
  version: number;
  width: number;
  height: number;
  difficulty: Difficulty;
  checkpoints: Checkpoint[];
  walls: Wall[];
  /** The one path that solves the board, as row-major cell indices. */
  solution: number[];
  metadata: ZipMetadata;
};

/** The parts of a puzzle the rules need. Lets tests and the tutorial build boards by hand. */
export type ZipShape = Pick<ZipPuzzle, "width" | "height" | "checkpoints" | "walls">;
