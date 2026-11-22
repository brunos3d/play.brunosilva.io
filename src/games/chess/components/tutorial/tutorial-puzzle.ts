import type { PlayableChess } from "../../hooks/use-chess-game";

/**
 * Teaching puzzle, written by hand: Black moves the rook off the back rank and
 * White mates on it. It is the smallest position that shows the two things a
 * new player has to know, that the opponent moves first and how a piece is
 * moved. A unit test keeps it valid.
 */
export const CHESS_TUTORIAL_PUZZLE: PlayableChess = {
  id: "chess-tutorial",
  seed: "tutorial",
  fen: "r5k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1",
  setup: "a8a2",
  line: ["e1e8"],
  solver: "white",
  kind: "mate",
  mateIn: 1,
  themes: ["backRankMate", "mateIn1"],
};
