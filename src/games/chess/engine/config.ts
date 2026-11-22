import type { Difficulty } from "@/shared/engine/difficulty";

/**
 * A recipe is one way of mining a puzzle out of a self-play game.
 *
 * - `mate`: the opponent's move allows a forced mate in `moves` moves.
 * - `win`: the opponent's move loses material to a line of `moves` solver moves.
 * - `defence`: the opponent's move makes a threat, and the solver has one move that holds.
 */
export type Recipe = {
  name: string;
  kind: "mate" | "win" | "defence";
  /** Solver moves in the solution. */
  moves: number;
  /** Relative odds inside the tier. */
  weight: number;
  /** Plies the search looks ahead at each solver move, before captures. */
  depth: number;
  /**
   * Mates only: the solver must have at least this many checks to choose from
   * on the first move, unless the line contains a sacrifice. More candidate
   * checks is what makes a forced mate hard to see.
   */
  minChecks?: number;
};

export type ChessTier = {
  recipes: readonly Recipe[];
  /** The game is played this many half-moves before the generator starts looking, [min, max]. Later starts mean fewer pieces. */
  startPly: readonly [number, number];
};

/** Centipawns the solution has to win over the balance before the mistake. A minor piece is 320. */
export const WIN_MARGIN = 250;
/** An alternative move counts as "also good" when it stays within this much of the best one, or wins this much by itself. */
export const UNIQUE_MARGIN = 200;
/** Advantage and defence puzzles start from games that were still balanced: within this much, in centipawns. */
export const BALANCED_WITHIN = 150;
/** A defence only counts when every other move loses at least this much. */
export const DEFENCE_MARGIN = 250;

/** Random centipawns added to each move's score in self-play. It is what makes two seeds play two different games. */
export const POLICY_NOISE = 24;
export const MAX_GAME_PLIES = 110;
/** Games mined per recipe before the generator falls back to the next one. */
export const GAMES_PER_RECIPE = 5;
/** Search nodes one game may spend. A budget in nodes, not time, keeps the result identical on every machine. */
export const GAME_NODE_BUDGET = 150_000;

/**
 * Recipes tried, in this order, when a tier's own recipes all came back empty.
 * They hit in most games, so every seed ends with a puzzle.
 */
export const FALLBACK_RECIPES: readonly Recipe[] = [
  { name: "mate2", kind: "mate", moves: 2, weight: 1, depth: 3 },
  { name: "mate1", kind: "mate", moves: 1, weight: 1, depth: 3 },
  { name: "win1", kind: "win", moves: 1, weight: 1, depth: 3 },
];
export const GAMES_PER_FALLBACK = 30;

export const CHESS_TIERS: Record<Difficulty, ChessTier> = {
  easy: {
    recipes: [
      { name: "mate1", kind: "mate", moves: 1, weight: 5, depth: 3 },
      { name: "win1", kind: "win", moves: 1, weight: 5, depth: 3 },
    ],
    startPly: [12, 44],
  },
  medium: {
    recipes: [
      { name: "mate2", kind: "mate", moves: 2, weight: 5, depth: 3 },
      { name: "win2", kind: "win", moves: 2, weight: 4, depth: 3 },
      { name: "defence1", kind: "defence", moves: 1, weight: 1.5, depth: 3 },
    ],
    startPly: [14, 50],
  },
  hard: {
    recipes: [
      { name: "mate3", kind: "mate", moves: 3, weight: 5, depth: 3 },
      { name: "mate2-sharp", kind: "mate", moves: 2, weight: 1.5, depth: 3, minChecks: 4 },
      { name: "win2", kind: "win", moves: 2, weight: 2.5, depth: 3 },
      { name: "defence1", kind: "defence", moves: 1, weight: 1, depth: 3 },
    ],
    startPly: [16, 56],
  },
  expert: {
    recipes: [
      { name: "mate3-sharp", kind: "mate", moves: 3, weight: 6, depth: 3, minChecks: 3 },
      { name: "mate3", kind: "mate", moves: 3, weight: 1, depth: 3 },
    ],
    startPly: [16, 60],
  },
};
