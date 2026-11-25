import { type Clock, restoreClock } from "@/shared/engine/clock";
import { type WendState, restoreTrails } from "../engine/game/state";
import { wendLanguage, wendSeeds } from "../engine/seed";
import type { WendShape } from "../engine/types";

const SNAPSHOT_VERSION = 1;

/**
 * What goes to disk for one Wend board: the trails on it and the counters.
 * Which trails are found words follows from the puzzle. The format has not
 * changed since the game had one language: the seed names the language of the
 * words, and a seed without one is Portuguese.
 */
export type WendSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  trails: { cells: number[]; hinted: number }[];
  moves: number;
  mistakes: number;
  hintsUsed: number;
  revealed: boolean;
  startedAt: number | null;
  finishedMs: number | null;
};

export function toWendSnapshot(state: WendState, seed: string, clock: Clock): WendSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed,
    trails: state.trails.map((trail) => ({ cells: [...trail.cells], hinted: trail.hinted })),
    moves: state.moves,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isTrail = (value: unknown): value is { cells: number[]; hinted: number } => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as { cells?: unknown; hinted?: unknown };
  return Array.isArray(entry.cells) && entry.cells.every(isCount) && isCount(entry.hinted);
};

/** False only when both are Wend seeds and name different languages. A stored seed that cannot be read decides nothing: the trails are checked against the board anyway. */
function sameLanguage(seed: string, stored: unknown): boolean {
  const [expected, found] = [wendSeeds.parse(seed), typeof stored === "string" ? wendSeeds.parse(stored) : null];
  return !expected || !found || wendLanguage(expected) === wendLanguage(found);
}

/**
 * Rebuilds a game from disk. Stored data is untrusted: every trail is checked
 * against the board, found words are worked out again, and a finished board
 * must carry a final time while an unfinished one must not. Anything off
 * returns null, and the caller starts a fresh board.
 *
 * `seed` is the seed of the puzzle on screen. With it, a board saved for the
 * same puzzle in another language is refused outright. The puzzle id already
 * keeps the languages apart, because it is made from the seed. This is the
 * second lock, for a snapshot whose id was tampered with.
 */
export function fromWendSnapshot(puzzleId: string, shape: WendShape, snapshot: unknown, seed?: string): { state: WendState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<WendSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
  if (seed !== undefined && !sameLanguage(seed, data.seed)) return null;
  if (!Array.isArray(data.trails) || !data.trails.every(isTrail)) return null;
  if (!isCount(data.moves) || !isCount(data.mistakes) || !isCount(data.hintsUsed)) return null;

  const restored = restoreTrails(shape, puzzleId, data.trails);
  if (!restored) return null;
  const clock = restoreClock(data.startedAt, data.finishedMs);
  if ((restored.status === "solved") !== (clock.finishedMs !== null)) return null;
  const revealed = data.revealed === true;
  // A revealed game holds no open trails: giving up erases them.
  const trails = revealed ? restored.trails.filter((trail) => trail.word !== null) : restored.trails;
  return { clock, state: { ...restored, trails, moves: data.moves, mistakes: data.mistakes, hintsUsed: data.hintsUsed, revealed } };
}
