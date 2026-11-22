import type { Difficulty } from "@/shared/engine/difficulty";

export { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";

/**
 * What the player is asked to do.
 *
 * - `mate`: force checkmate in a fixed number of moves.
 * - `advantage`: win material with the only move that does.
 * - `defence`: the position is under threat and one move holds it together.
 */
export type PuzzleKind = "mate" | "advantage" | "defence";

/** Tactical ideas the generator recognizes in a solution. They word the coach's hints and show in the debug panel. */
export type ChessTheme =
  | "mateIn1"
  | "mateIn2"
  | "mateIn3"
  | "backRankMate"
  | "smotheredMate"
  | "sacrifice"
  | "fork"
  | "discoveredAttack"
  | "hangingPiece"
  | "promotion"
  | "defensiveMove";

export type SideName = "white" | "black";

export type ChessMetadata = {
  generatorVersion: number;
  shareSeed: string;
  /** Which recipe of the tier built the puzzle, for example `mate2` or `win1`. */
  recipe: string;
  /** Self-play games mined before one gave a puzzle, 1-based. */
  games: number;
  /** Half-move of the game on which the puzzle starts. */
  ply: number;
  /** Search nodes spent on the whole generation. */
  nodes: number;
  /** Centipawns the solution wins over the balance before the opponent's mistake. Zero for mates. */
  gain: number;
  /** Pieces on the board when the puzzle starts, kings included. */
  pieces: number;
};

export type ChessPuzzle = {
  id: string;
  seed: string;
  version: number;
  difficulty: Difficulty;
  /** Position before the opponent's last move, in FEN. The game that led here was played from the starting position, so it is always reachable. */
  fen: string;
  /** The opponent's last move, in UCI form. The puzzle opens by playing it. */
  setup: string;
  /** The solution from the position after `setup`: solver, opponent, solver, and so on. It always ends on a solver move. */
  line: string[];
  solver: SideName;
  kind: PuzzleKind;
  /** Solver moves until mate. Zero when the puzzle is not a mate. */
  mateIn: number;
  themes: ChessTheme[];
  metadata: ChessMetadata;
};

/** The parts of a puzzle the game state needs. Lets tests and the tutorial write puzzles by hand. */
export type ChessShape = Pick<ChessPuzzle, "fen" | "setup" | "line" | "solver" | "kind" | "mateIn" | "themes">;
