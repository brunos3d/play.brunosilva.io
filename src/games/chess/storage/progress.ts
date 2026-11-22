import { type Clock, restoreClock } from "@/shared/engine/clock";
import { type ChessState, createChessGame } from "../engine/game/state";
import { moveFromUci, moveToUci } from "../engine/position";
import { type ResolvedPuzzle, positionAfter } from "../engine/puzzle";
import { isCheckmate } from "../engine/search";

const SNAPSHOT_VERSION = 1;

/** What goes to disk for one chess puzzle. The position is not stored: it follows from the puzzle and from how far the player got. */
export type ChessSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  /** Solution half-moves played. */
  progress: number;
  /** A mating move the player found in place of the stored last move, in UCI form. */
  finish: string | null;
  solved: boolean;
  moves: number;
  mistakes: number;
  hintsUsed: number;
  revealed: boolean;
  startedAt: number | null;
  finishedMs: number | null;
};

export function toChessSnapshot(state: ChessState, seed: string, clock: Clock): ChessSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed,
    progress: state.progress,
    finish: state.finish === null ? null : moveToUci(state.finish),
    solved: state.status === "solved",
    moves: state.moves,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * Rebuilds a game from disk. Stored data is untrusted. Progress has to fit the
 * line, a board only counts as solved if the line was played to its end or the
 * stored finishing move really is checkmate, and a solved board must carry a
 * final time. Anything off returns null, and the caller starts a fresh board.
 *
 * A wrong move on the board is never stored, and a board saved between a right
 * move and the opponent's reply comes back with the reply played.
 */
export function fromChessSnapshot(puzzleId: string, puzzle: ResolvedPuzzle, snapshot: unknown): { state: ChessState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<ChessSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzleId) return null;
  if (!isCount(data.progress) || !isCount(data.moves) || !isCount(data.mistakes) || !isCount(data.hintsUsed)) return null;
  const length = puzzle.line.length;
  if (data.progress > length) return null;

  let progress = data.progress;
  let finish: ChessState["finish"] = null;
  let solved = false;
  if (typeof data.finish === "string") {
    if (progress === 0 || progress % 2 === 0) return null;
    const position = positionAfter(puzzle, puzzle.line.slice(0, progress - 1));
    const move = moveFromUci(position, data.finish);
    if (move === 0) return null;
    position.make(move);
    if (!isCheckmate(position)) return null;
    finish = move === puzzle.line[progress - 1] ? null : move;
    solved = true;
  } else if (progress === length) {
    solved = true;
  } else if (progress % 2 === 1) {
    progress++;
  }
  if (data.solved === true && !solved) return null;

  const clock = restoreClock(data.startedAt, data.finishedMs);
  if (solved !== (clock.finishedMs !== null)) return null;
  return {
    clock,
    state: { ...createChessGame(puzzleId), progress, finish, status: solved ? "solved" : "playing", moves: data.moves, mistakes: data.mistakes, hintsUsed: data.hintsUsed, revealed: data.revealed === true },
  };
}
