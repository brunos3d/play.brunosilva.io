import type { Topology } from "../grid";
import { type MoveError, checkStep, validatePath } from "../rules";

export type ZipStatus = "playing" | "solved";

export type ZipState = {
  puzzleId: string;
  /** Cells of the path, in order. */
  path: readonly number[];
  /** Paths before each finished gesture. Undo pops the last one. */
  history: readonly (readonly number[])[];
  status: ZipStatus;
  /** Gestures that changed the path. */
  moves: number;
  /** Times the player took cells back: dragging backwards, tapping the path, or Undo. */
  backtracks: number;
  hintsUsed: number;
  /** The player asked for the solution. The board accepts no input from then on. */
  revealed: boolean;
};

export type StepEvent = "extend" | "checkpoint" | "back" | "solved";

export type StepResult = { ok: true; state: ZipState; event: StepEvent } | { ok: false; state: ZipState; error: MoveError | null };

export function createZipGame(puzzleId: string): ZipState {
  return { puzzleId, path: [], history: [], status: "playing", moves: 0, backtracks: 0, hintsUsed: 0, revealed: false };
}

export function isZipLocked(state: ZipState): boolean {
  return state.status === "solved" || state.revealed;
}

/**
 * Moves the head of the path into `cell`. Stepping onto the previous cell takes
 * the last step back. Anything else must pass the rules in rules.ts. A refused
 * step returns the same state plus the rule that refused it, so the path can
 * never be corrupted. Counters are left alone here: a drag is many steps but
 * one move, and `commitGesture` does the counting when it ends.
 */
export function stepTo(topology: Topology, state: ZipState, cell: number): StepResult {
  if (isZipLocked(state)) return { ok: false, state, error: null };
  const { path } = state;

  if (path.length >= 2 && path[path.length - 2] === cell) {
    return { ok: true, state: { ...state, path: path.slice(0, -1) }, event: "back" };
  }
  if (path.length > 0 && path[path.length - 1] === cell) return { ok: false, state, error: null };

  const error = checkStep(topology, path, cell);
  if (error) return { ok: false, state, error };

  const next = [...path, cell];
  // Completion is decided by the full validator, not by the length of the path.
  const solved = next.length === topology.playableCount && validatePath(topology, next).complete;
  const event: StepEvent = solved ? "solved" : topology.numberAt[cell] !== 0 ? "checkpoint" : "extend";
  return { ok: true, state: { ...state, path: next, status: solved ? "solved" : "playing" }, event };
}

/** Cuts the path back so that it ends on `cell`. Returns the same state when the cell is not on the path. */
export function truncateTo(state: ZipState, cell: number): ZipState {
  if (isZipLocked(state)) return state;
  const index = state.path.indexOf(cell);
  if (index < 0 || index === state.path.length - 1) return state;
  return { ...state, path: state.path.slice(0, index + 1) };
}

const commonPrefix = (a: readonly number[], b: readonly number[]): number => {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
};

/**
 * Closes a gesture (one drag, one tap, one key press). If the path changed, the
 * earlier path goes on the undo stack and the counters move: one move per
 * gesture, plus one backtrack if the gesture took back any cell.
 */
export function commitGesture(state: ZipState, pathBefore: readonly number[]): ZipState {
  const same = pathBefore.length === state.path.length && commonPrefix(pathBefore, state.path) === pathBefore.length;
  if (same) return state;
  const tookBack = commonPrefix(pathBefore, state.path) < pathBefore.length;
  return {
    ...state,
    // A solved board keeps no undo stack: it is locked.
    history: state.status === "solved" ? [] : [...state.history, pathBefore],
    moves: state.moves + 1,
    backtracks: state.backtracks + (tookBack ? 1 : 0),
  };
}

export function canUndoZip(state: ZipState): boolean {
  return !isZipLocked(state) && state.history.length > 0;
}

/** Restores the path from before the last gesture. */
export function undoZip(state: ZipState): ZipState {
  if (!canUndoZip(state)) return state;
  const previous = state.history[state.history.length - 1];
  const tookBack = commonPrefix(previous, state.path) < state.path.length;
  return { ...state, path: previous, history: state.history.slice(0, -1), backtracks: state.backtracks + (tookBack ? 1 : 0) };
}

/** Clears the path and the undo stack. Counters survive, so a reset cannot polish a result. */
export function resetZip(state: ZipState): ZipState {
  if (isZipLocked(state) || state.path.length === 0) return state;
  return { ...state, path: [], history: [] };
}

export function recordZipHint(state: ZipState): ZipState {
  return isZipLocked(state) ? state : { ...state, hintsUsed: state.hintsUsed + 1 };
}

/**
 * One step of revealing the solution: first the path is cut back to where it
 * still follows the solution, then it grows one cell per step. The UI calls
 * this on a timer, and a reload in the middle carries on from the saved path.
 */
export function revealZipStep(solution: readonly number[], state: ZipState): ZipState {
  if (state.status === "solved") return state;
  const locked: ZipState = state.revealed ? state : { ...state, revealed: true, history: [] };
  const keep = commonPrefix(locked.path, solution);
  if (keep < locked.path.length) return { ...locked, path: locked.path.slice(0, keep) };
  const path = [...locked.path, solution[locked.path.length]];
  return { ...locked, path, status: path.length === solution.length ? "solved" : "playing" };
}
