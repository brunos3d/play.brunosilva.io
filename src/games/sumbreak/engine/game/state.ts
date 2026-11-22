import { type MergeError, applyMerge, checkMerge, countTiles, replayMerges } from "../rules";
import { SumbreakSolver } from "../solver";
import type { Merge, SumbreakShape } from "../types";

export type SumbreakStatus = "playing" | "solved";

export type SumbreakState = {
  puzzleId: string;
  cells: readonly number[];
  /** Every merge on the board, in order. Undo pops the last one. */
  history: readonly Merge[];
  /**
   * How many merges of `history` were still fine: the merge after them is the
   * one that left a board no order of merges can finish. Null while the board
   * can still be solved. The player is not told. Getting stuck, or a hint, is
   * how they find out.
   */
  brokenAt: number | null;
  status: SumbreakStatus;
  /** Merges the player made. Merges played by a hint do not count. */
  moves: number;
  /** Merges that left the board unsolvable. */
  mistakes: number;
  hintsUsed: number;
  /** The player asked for the solution. The board accepts no input from then on. */
  revealed: boolean;
};

export type MergeResult = { ok: true; state: SumbreakState; solved: boolean } | { ok: false; state: SumbreakState; error: MergeError | null };

export function createSumbreakGame(puzzleId: string, shape: SumbreakShape): SumbreakState {
  return { puzzleId, cells: shape.cells, history: [], brokenAt: null, status: "playing", moves: 0, mistakes: 0, hintsUsed: 0, revealed: false };
}

export function isSumbreakLocked(state: SumbreakState): boolean {
  return state.status === "solved" || state.revealed;
}

function advance(shape: SumbreakShape, state: SumbreakState, merge: Merge): SumbreakState {
  const cells = applyMerge(state.cells, merge);
  const history = [...state.history, merge];
  const solved = countTiles(cells) === 1;
  // Once the board is broken it stays broken until the bad merge is taken back, so there is nothing new to check.
  const breaks = state.brokenAt === null && !solved && !new SumbreakSolver(shape.size).isSolvable(cells);
  return { ...state, cells, history, brokenAt: breaks ? state.history.length : state.brokenAt, status: solved ? "solved" : "playing" };
}

/**
 * The player merges two tiles. An illegal merge returns the same state plus the
 * rule that refused it. A legal one is always played, even when it leaves a
 * board that cannot be finished: finding the order is the puzzle.
 */
export function mergeTiles(shape: SumbreakShape, state: SumbreakState, merge: Merge): MergeResult {
  if (isSumbreakLocked(state)) return { ok: false, state, error: null };
  const error = checkMerge(shape.size, state.cells, merge);
  if (error) return { ok: false, state, error };
  const next = advance(shape, state, merge);
  const broke = state.brokenAt === null && next.brokenAt !== null;
  return { ok: true, state: { ...next, moves: state.moves + 1, mistakes: state.mistakes + (broke ? 1 : 0) }, solved: next.status === "solved" };
}

/** Plays a merge on the player's behalf: by a hint, or during the reveal. It is not counted as a move. */
export function playMerge(shape: SumbreakShape, state: SumbreakState, merge: Merge): SumbreakState {
  if (state.status === "solved" || checkMerge(shape.size, state.cells, merge)) return state;
  return advance(shape, state, merge);
}

/** Keeps the first `count` merges and takes the rest off the board. The counters stay, since they record what happened. */
export function rewindTo(shape: SumbreakShape, state: SumbreakState, count: number): SumbreakState {
  if (state.status === "solved" || count < 0 || count >= state.history.length) return state;
  const history = state.history.slice(0, count);
  const cells = replayMerges(shape.size, shape.cells, history);
  if (!cells) return state;
  return { ...state, cells, history, brokenAt: state.brokenAt !== null && count <= state.brokenAt ? null : state.brokenAt };
}

export function canUndoSumbreak(state: SumbreakState): boolean {
  return !isSumbreakLocked(state) && state.history.length > 0;
}

export function undoSumbreak(shape: SumbreakShape, state: SumbreakState): SumbreakState {
  return canUndoSumbreak(state) ? rewindTo(shape, state, state.history.length - 1) : state;
}

/** Back to the starting board. The clock and the counters survive. */
export function resetSumbreak(shape: SumbreakShape, state: SumbreakState): SumbreakState {
  return canUndoSumbreak(state) ? rewindTo(shape, state, 0) : state;
}

export function recordSumbreakHint(state: SumbreakState): SumbreakState {
  return { ...state, hintsUsed: state.hintsUsed + 1 };
}

/** Marks the board as given up. From then on only `playMerge` moves it. */
export function beginSumbreakReveal(state: SumbreakState): SumbreakState {
  return { ...state, revealed: true };
}

/** A tile with an identity that survives merges, so the UI can slide and grow the same element. */
export type BoardTile = { id: number; cell: number; value: number };

/** The tiles on the board after some merges, each named after the cell it started on. A merged tile keeps the identity of the one that stayed. */
export function tilesOnBoard(shape: SumbreakShape, history: readonly Merge[]): BoardTile[] {
  const cells = replayMerges(shape.size, shape.cells, history) ?? [...shape.cells];
  const tiles: BoardTile[] = [];
  for (let cell = 0; cell < cells.length; cell++) if (cells[cell] !== 0) tiles.push({ id: cell, cell, value: cells[cell] });
  return tiles;
}
