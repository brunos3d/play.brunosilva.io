import { moveCaptured, movePromotion } from "./position";
import { positionAfter, resolvePuzzle } from "./puzzle";
import { isCheckmate, mateIn, matingMoves } from "./search";
import type { ChessShape } from "./types";

export type PuzzleCheck = { ok: boolean; errors: string[] };

/**
 * Independent check of a finished puzzle, used by tests and by the validate
 * tool. It replays every move for legality and, for mates, proves again with
 * the exact search that the mate takes the stated number of moves and that each
 * solver move before the last is the only one that keeps it.
 */
export function validateChessPuzzle(shape: ChessShape): PuzzleCheck {
  const errors: string[] = [];
  let puzzle;
  try {
    puzzle = resolvePuzzle(shape);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : "unreadable puzzle"] };
  }
  const solverMoves = (puzzle.line.length + 1) / 2;

  if (shape.kind === "mate") {
    if (shape.mateIn !== solverMoves) errors.push(`mate in ${shape.mateIn} with ${solverMoves} solver moves`);
    if (!isCheckmate(positionAfter(puzzle, puzzle.line))) errors.push("the line does not end in checkmate");
    for (let index = 0; index < puzzle.line.length; index += 2) {
      const position = positionAfter(puzzle, puzzle.line.slice(0, index));
      const remaining = solverMoves - index / 2;
      if (mateIn(position, remaining) !== remaining) errors.push(`move ${index / 2 + 1}: mate distance is not ${remaining}`);
      const mates = matingMoves(position, remaining, false);
      if (!mates.includes(puzzle.line[index])) errors.push(`move ${index / 2 + 1}: the stored move does not mate in time`);
      if (mates.length > 1 && (remaining > 1 || solverMoves === 1)) errors.push(`move ${index / 2 + 1}: ${mates.length} moves mate in time`);
    }
  } else {
    if (shape.mateIn !== 0) errors.push("mateIn set on a puzzle that is not a mate");
    const last = puzzle.line[puzzle.line.length - 1];
    if (shape.kind === "advantage" && moveCaptured(last) === 0 && movePromotion(last) === 0) errors.push("the line does not end by winning material");
    if (shape.kind === "defence" && puzzle.line.length !== 1) errors.push("a defence is one move");
    if (isCheckmate(positionAfter(puzzle, puzzle.line))) errors.push("the line ends in mate but the puzzle is not a mate");
  }
  if (positionAfter(puzzle, []).legalMoves().length < 3) errors.push("the solver has no choice on the first move");
  return { ok: errors.length === 0, errors };
}
