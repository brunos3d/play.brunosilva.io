import { type Clock, restoreClock } from "@/shared/engine/clock";
import { EMPTY, MARK, MAX_HISTORY, QUEEN, type QueensState, createQueensGame, queensOf } from "../engine/game/state";
import type { Topology } from "../engine/grid";
import { validateQueens } from "../engine/rules";

const SNAPSHOT_VERSION = 1;

/** What goes to disk for one Queens board. */
export type QueensSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  marks: number[];
  history: number[][];
  moves: number;
  takebacks: number;
  hintsUsed: number;
  revealed: boolean;
  startedAt: number | null;
  finishedMs: number | null;
};

export function toQueensSnapshot(state: QueensState, seed: string, clock: Clock): QueensSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed,
    marks: [...state.marks],
    history: state.history.map((marks) => [...marks]),
    moves: state.moves,
    takebacks: state.takebacks,
    hintsUsed: state.hintsUsed,
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** A board of the right length that only holds known values and whose queens break no rule. */
function isLegalBoard(topology: Topology, value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== topology.cellCount) return false;
  if (!value.every((mark) => mark === EMPTY || mark === MARK || mark === QUEEN)) return false;
  return validateQueens(topology, queensOf(value)).conflicts.length === 0;
}

/**
 * Rebuilds a game from disk. Stored data is untrusted: every board, the undo
 * stack included, is checked against the rules again, and a board only counts
 * as solved if the validator says so. Anything off returns null, and the
 * caller starts a fresh board.
 */
export function fromQueensSnapshot(puzzleId: string, topology: Topology, snapshot: unknown): { state: QueensState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<QueensSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
  if (!isLegalBoard(topology, data.marks)) return null;
  if (!Array.isArray(data.history) || data.history.length > MAX_HISTORY || !data.history.every((marks) => isLegalBoard(topology, marks))) return null;
  if (!isCount(data.moves) || !isCount(data.takebacks) || !isCount(data.hintsUsed)) return null;

  const complete = validateQueens(topology, queensOf(data.marks)).complete;
  const clock = restoreClock(data.startedAt, data.finishedMs);
  if (complete !== (clock.finishedMs !== null)) return null;
  return {
    clock,
    state: {
      ...createQueensGame(puzzleId, topology.cellCount),
      marks: data.marks,
      history: complete ? [] : data.history,
      status: complete ? "solved" : "playing",
      moves: data.moves,
      takebacks: data.takebacks,
      hintsUsed: data.hintsUsed,
      revealed: data.revealed === true,
    },
  };
}
