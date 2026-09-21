import { type Clock, restoreClock } from "@/shared/engine/clock";
import { type ZipState, createZipGame } from "../engine/game/state";
import type { Topology } from "../engine/grid";
import { validatePath } from "../engine/rules";

const SNAPSHOT_VERSION = 1;

/** What goes to disk for one Zip board. */
export type ZipSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  path: number[];
  history: number[][];
  moves: number;
  backtracks: number;
  hintsUsed: number;
  revealed: boolean;
  startedAt: number | null;
  finishedMs: number | null;
};

export function toZipSnapshot(state: ZipState, seed: string, clock: Clock): ZipSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed,
    path: [...state.path],
    history: state.history.map((path) => [...path]),
    moves: state.moves,
    backtracks: state.backtracks,
    hintsUsed: state.hintsUsed,
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isPath = (value: unknown): value is number[] => Array.isArray(value) && value.every(isCount);

/**
 * Rebuilds a game from disk. Stored data is untrusted: the path is walked again
 * through the rules, and a board only counts as solved if the validator says
 * so. Anything off returns null, and the caller starts a fresh board.
 */
export function fromZipSnapshot(puzzleId: string, topology: Topology, snapshot: unknown): { state: ZipState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<ZipSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
  if (!isPath(data.path) || !Array.isArray(data.history) || !data.history.every(isPath)) return null;
  if (!isCount(data.moves) || !isCount(data.backtracks) || !isCount(data.hintsUsed)) return null;

  const check = validatePath(topology, data.path);
  if (check.error) return null;
  if (data.history.some((path) => validatePath(topology, path).error)) return null;

  const clock = restoreClock(data.startedAt, data.finishedMs);
  if (check.complete !== (clock.finishedMs !== null)) return null;
  return {
    clock,
    state: {
      ...createZipGame(puzzleId),
      path: data.path,
      history: check.complete ? [] : data.history,
      status: check.complete ? "solved" : "playing",
      moves: data.moves,
      backtracks: data.backtracks,
      hintsUsed: data.hintsUsed,
      revealed: data.revealed === true,
    },
  };
}
