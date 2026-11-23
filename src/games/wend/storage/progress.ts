import { type Clock, restoreClock } from "@/shared/engine/clock";
import { type WendState, restoreTrails } from "../engine/game/state";
import type { WendShape } from "../engine/types";

const SNAPSHOT_VERSION = 1;

/** What goes to disk for one Wend board: the trails on it and the counters. Which trails are found words follows from the puzzle. */
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

/**
 * Rebuilds a game from disk. Stored data is untrusted: every trail is checked
 * against the board, found words are worked out again, and a finished board
 * must carry a final time while an unfinished one must not. Anything off
 * returns null, and the caller starts a fresh board.
 */
export function fromWendSnapshot(puzzleId: string, shape: WendShape, snapshot: unknown): { state: WendState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<WendSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
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
