import { type Clock, restoreClock } from "@/shared/engine/clock";
import { type SumbreakState, createSumbreakGame } from "../engine/game/state";
import { applyMerge, checkMerge, countTiles } from "../engine/rules";
import { SumbreakSolver } from "../engine/solver";
import type { Merge, SumbreakShape } from "../engine/types";

const SNAPSHOT_VERSION = 1;

/** What goes to disk for one Sumbreak board. The board itself is not stored: it follows from the puzzle and the merges made. */
export type SumbreakSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  /** Each merge as [from, to]. */
  history: [number, number][];
  moves: number;
  mistakes: number;
  hintsUsed: number;
  revealed: boolean;
  startedAt: number | null;
  finishedMs: number | null;
};

export function toSumbreakSnapshot(state: SumbreakState, seed: string, clock: Clock): SumbreakSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed,
    history: state.history.map((merge) => [merge.from, merge.to]),
    moves: state.moves,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isPair = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(isCount);

/**
 * Rebuilds a game from disk. Stored data is untrusted: every merge is played
 * again through the rules, the point where the board stopped being solvable is
 * worked out again by the solver, and a board only counts as solved if one tile
 * is left. A finished board must carry a final time and an unfinished one must
 * not. Anything off returns null, and the caller starts a fresh board.
 */
export function fromSumbreakSnapshot(puzzleId: string, shape: SumbreakShape, snapshot: unknown): { state: SumbreakState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<SumbreakSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
  if (!Array.isArray(data.history) || !data.history.every(isPair)) return null;
  if (!isCount(data.moves) || !isCount(data.mistakes) || !isCount(data.hintsUsed)) return null;

  const solver = new SumbreakSolver(shape.size);
  const history: Merge[] = [];
  let cells = [...shape.cells];
  let brokenAt: number | null = null;
  for (const [from, to] of data.history) {
    const merge = { from, to };
    if (checkMerge(shape.size, cells, merge)) return null;
    cells = applyMerge(cells, merge);
    if (brokenAt === null && countTiles(cells) > 1 && !solver.isSolvable(cells)) brokenAt = history.length;
    history.push(merge);
  }

  const solved = countTiles(cells) === 1;
  const clock = restoreClock(data.startedAt, data.finishedMs);
  if (solved !== (clock.finishedMs !== null)) return null;
  return {
    clock,
    state: { ...createSumbreakGame(puzzleId, shape), cells, history, brokenAt, status: solved ? "solved" : "playing", moves: data.moves, mistakes: data.mistakes, hintsUsed: data.hintsUsed, revealed: data.revealed === true },
  };
}
