import type { Difficulty } from "@/shared/engine/difficulty";

export { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";

/** One move: the tile on `from` is dropped onto the equal tile on `to`. `to` then holds the sum and `from` is empty. Cells are row-major indices. */
export type Merge = { from: number; to: number };

/** The parts of a puzzle the rules need. A cell holds its number, or 0 when it is empty. */
export type SumbreakShape = { size: number; cells: readonly number[] };

export type SumbreakMetadata = {
  generatorVersion: number;
  shareSeed: string;
  /** Boards built before one was kept, 1-based. */
  attempts: number;
  /** Positions the solver visited to measure the board. */
  solverNodes: number;
  /**
   * Chance that a careful but aimless player ends with one tile. It is the
   * difficulty measure: the lower it is, the more merges are traps that take
   * thought to see. See `SumbreakSolver.winChance`.
   */
  winChance: number;
  /** Legal merges on the starting board, counting both directions of a pair. */
  openingMoves: number;
};

export type SumbreakPuzzle = SumbreakShape & {
  id: string;
  seed: string;
  version: number;
  difficulty: Difficulty;
  /** The number on the last tile: the sum of all the starting tiles. */
  total: number;
  /** One order of merges that ends with a single tile. Many boards have others. */
  solution: Merge[];
  metadata: SumbreakMetadata;
};
