import type { PlayableWend } from "../../hooks/use-wend-game";

/**
 * A fixed 3x3 board for the tutorial: UVA along the top row and FIGO around
 * the corner, with two walls.
 *
 *   U V A
 *   # O G
 *   # F I
 */
export const WEND_TUTORIAL_PUZZLE: PlayableWend = {
  id: "wend-tutorial",
  seed: "WEND:tutorial:1:easy",
  size: 3,
  letters: ["U", "V", "A", "", "O", "G", "", "F", "I"],
  words: [
    { text: "UVA", display: "UVA", path: [0, 1, 2] },
    { text: "FIGO", display: "FIGO", path: [7, 8, 5, 4] },
  ],
};
