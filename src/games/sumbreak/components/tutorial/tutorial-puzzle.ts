import type { PlayableSumbreak } from "../../hooks/use-sumbreak-game";

/**
 * Teaching board, written by hand. The two 1s can merge either way, and only
 * one way leaves the 2 next to the other 2: the smallest board that shows why
 * the direction of a merge matters. A unit test keeps it solvable.
 *
 *   1  1  .
 *   2  4  8
 *   .  32 16
 */
export const SUMBREAK_TUTORIAL_PUZZLE: PlayableSumbreak = {
  id: "sumbreak-tutorial",
  seed: "tutorial",
  size: 3,
  cells: [1, 1, 0, 2, 4, 8, 0, 32, 16],
};
