import type { Topology } from "../grid";
import { type MoveError, checkQueen, validateQueens } from "../rules";

/** What a cell holds. An X is the player's note that no queen goes there. */
export const EMPTY = 0;
export const MARK = 1;
export const QUEEN = 2;

export type QueensStatus = "playing" | "solved";

export type QueensState = {
  puzzleId: string;
  /** One value per cell, row-major: EMPTY, MARK or QUEEN. */
  marks: readonly number[];
  /** Boards before each finished action. Undo pops the last one. */
  history: readonly (readonly number[])[];
  status: QueensStatus;
  /** Actions that changed the board: a tap, a drag of X's, a hint. */
  moves: number;
  /** Queens taken off the board after being placed, by the player, by Undo or by a hint. */
  takebacks: number;
  hintsUsed: number;
  /** The player asked for the solution. The board accepts no input from then on. */
  revealed: boolean;
};

/** Undo steps kept. Older ones are dropped, so a long session cannot grow the saved board without bound. */
export const MAX_HISTORY = 200;

export type CycleEvent = "mark" | "queen" | "clear" | "solved";

export type CycleResult = { ok: true; state: QueensState; event: CycleEvent } | { ok: false; state: QueensState; error: MoveError | null };

export function createQueensGame(puzzleId: string, cellCount: number): QueensState {
  return { puzzleId, marks: new Array<number>(cellCount).fill(EMPTY), history: [], status: "playing", moves: 0, takebacks: 0, hintsUsed: 0, revealed: false };
}

export function isQueensLocked(state: QueensState): boolean {
  return state.status === "solved" || state.revealed;
}

export function queensOf(marks: readonly number[]): number[] {
  const queens: number[] = [];
  for (let cell = 0; cell < marks.length; cell++) if (marks[cell] === QUEEN) queens.push(cell);
  return queens;
}

const withCell = (state: QueensState, cell: number, value: number): QueensState => {
  const marks = [...state.marks];
  marks[cell] = value;
  return { ...state, marks };
};

/**
 * Puts a queen on `cell`, whatever it held. A queen that breaks a rule against
 * a queen already on the board is refused: the same state comes back with the
 * rule, so the board never holds an illegal position. Completion is decided by
 * the full validator, not by counting queens.
 */
export function placeQueenAt(topology: Topology, state: QueensState, cell: number): CycleResult {
  if (isQueensLocked(state) || state.marks[cell] === QUEEN) return { ok: false, state, error: null };
  const queens = queensOf(state.marks);
  const error = checkQueen(topology, queens, cell);
  if (error) return { ok: false, state, error };
  const next = withCell(state, cell, QUEEN);
  const solved = queens.length + 1 === topology.size && validateQueens(topology, [...queens, cell]).complete;
  return { ok: true, state: solved ? { ...next, status: "solved" } : next, event: solved ? "solved" : "queen" };
}

/**
 * One tap: empty, X, queen, empty. The step from X to queen is the one that can
 * be refused. `skipQueen` is set when the previous tap on this same cell was
 * refused: the X then clears, so a cell that can never take a queen does not
 * keep its X forever.
 */
export function cycleCell(topology: Topology, state: QueensState, cell: number, skipQueen = false): CycleResult {
  if (isQueensLocked(state)) return { ok: false, state, error: null };
  const current = state.marks[cell];
  if (current === EMPTY) return { ok: true, state: withCell(state, cell, MARK), event: "mark" };
  if (current === QUEEN) return { ok: true, state: withCell(state, cell, EMPTY), event: "clear" };
  if (skipQueen) return { ok: true, state: withCell(state, cell, EMPTY), event: "clear" };
  return placeQueenAt(topology, state, cell);
}

/**
 * One cell of a drag. A drag that started on an empty cell paints X's over
 * empty cells, and one that started on an X erases X's. Queens are never
 * touched by a drag. Returns the same state when the cell does not change.
 */
export function paintCell(state: QueensState, cell: number, mode: "mark" | "erase"): QueensState {
  if (isQueensLocked(state)) return state;
  const current = state.marks[cell];
  if (mode === "mark" && current === EMPTY) return withCell(state, cell, MARK);
  if (mode === "erase" && current === MARK) return withCell(state, cell, EMPTY);
  return state;
}

/** Empties a cell. Used by the Delete key. */
export function clearCell(state: QueensState, cell: number): QueensState {
  if (isQueensLocked(state) || state.marks[cell] === EMPTY) return state;
  return withCell(state, cell, EMPTY);
}

const sameMarks = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((value, cell) => value === b[cell]);

const queensLost = (before: readonly number[], after: readonly number[]): number => {
  let lost = 0;
  for (let cell = 0; cell < before.length; cell++) if (before[cell] === QUEEN && after[cell] !== QUEEN) lost++;
  return lost;
};

/**
 * Closes an action (one tap, one drag, one key press, one hint). If the board
 * changed, the earlier board goes on the undo stack and the counters move: one
 * move per action, plus one takeback per queen that left the board.
 */
export function commitAction(state: QueensState, marksBefore: readonly number[]): QueensState {
  if (sameMarks(marksBefore, state.marks)) return state;
  return {
    ...state,
    // A solved board keeps no undo stack: it is locked.
    history: state.status === "solved" ? [] : [...state.history, marksBefore].slice(-MAX_HISTORY),
    moves: state.moves + 1,
    takebacks: state.takebacks + queensLost(marksBefore, state.marks),
  };
}

export function canUndoQueens(state: QueensState): boolean {
  return !isQueensLocked(state) && state.history.length > 0;
}

/** Restores the board from before the last action. */
export function undoQueens(state: QueensState): QueensState {
  if (!canUndoQueens(state)) return state;
  const previous = state.history[state.history.length - 1];
  return { ...state, marks: previous, history: state.history.slice(0, -1), takebacks: state.takebacks + queensLost(state.marks, previous) };
}

/** Clears the board and the undo stack. Counters survive, so a reset cannot polish a result. */
export function resetQueens(state: QueensState): QueensState {
  if (isQueensLocked(state) || state.marks.every((value) => value === EMPTY)) return state;
  return { ...state, marks: state.marks.map(() => EMPTY), history: [] };
}

export function recordQueensHint(state: QueensState): QueensState {
  return isQueensLocked(state) ? state : { ...state, hintsUsed: state.hintsUsed + 1 };
}

/**
 * One step of revealing the solution: first a queen that is not part of it
 * comes off, then the missing queens go on, top row first. The UI calls this
 * on a timer, and a reload in the middle carries on from the saved board.
 */
export function revealQueensStep(topology: Topology, solution: readonly number[], state: QueensState): QueensState {
  if (state.status === "solved") return state;
  const locked: QueensState = state.revealed ? state : { ...state, revealed: true, history: [] };
  const wanted = new Set(solution);
  const wrong = queensOf(locked.marks).find((cell) => !wanted.has(cell));
  if (wrong !== undefined) return withCell(locked, wrong, EMPTY);
  const missing = solution.find((cell) => locked.marks[cell] !== QUEEN);
  if (missing === undefined) return locked;
  const next = withCell(locked, missing, QUEEN);
  const complete = validateQueens(topology, queensOf(next.marks)).complete;
  return complete ? { ...next, status: "solved" } : next;
}
