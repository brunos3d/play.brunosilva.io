import type { PlayablePuzzle } from "../../hooks/use-patches-game";

/**
 * Teaching board, 4x4. Only the clues are written by hand. The solution is
 * never stored: the same engine validates every move, and a unit test asserts
 * that the solver finds exactly one solution.
 *
 *   A A C C      A: 4, square        C: 6, tall
 *   A A C C      B: wide, no number  D: any shape, no number
 *   B B C C
 *   D D D D
 */
export const TUTORIAL_PUZZLE: PlayablePuzzle = {
  id: "patches-tutorial",
  seed: "tutorial",
  width: 4,
  height: 4,
  clues: [
    { id: "a", row: 0, column: 0, area: 4, shape: "square" },
    { id: "c", row: 1, column: 3, area: 6, shape: "tall" },
    { id: "b", row: 2, column: 0, shape: "wide" },
    { id: "d", row: 3, column: 2, shape: "freeform" },
  ],
};
