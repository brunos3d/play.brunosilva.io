import { FLAG_CASTLE_KING, FLAG_CASTLE_QUEEN, FLAG_EN_PASSANT, type Move, Position, moveCaptured, moveFlag, moveFrom, movePiece, movePromotion, moveTo } from "../position";
import type { ResolvedPuzzle } from "../puzzle";
import type { ChessTheme } from "../types";

/**
 * What a move does, as data. Each language turns it into a phrase with its own
 * grammar, so this is the part of the move describer they share.
 */
export type MoveFacts = {
  /** Type of the piece that moves. A promoting pawn is still a pawn here. */
  piece: number;
  from: number;
  to: number;
  /** Type of the captured piece, or 0. */
  captured: number;
  enPassant: boolean;
  /** Type the pawn becomes, or 0. */
  promotion: number;
  castle: "king" | "queen" | null;
  /** Another piece of the same kind could go to the same square, so the phrase has to say which one moves. */
  ambiguous: boolean;
  /** The capture takes the piece the move before brought to this square. */
  recapture: boolean;
  check: boolean;
  mate: boolean;
};

/** Reads a legal move of `position`, which is left as it was. `after` is the move played right before it, when the caller told that one too. */
export function moveFacts(position: Position, move: Move, after?: Move): MoveFacts {
  const piece = movePiece(move);
  const from = moveFrom(move);
  const to = moveTo(move);
  const flag = moveFlag(move);
  const captured = moveCaptured(move);
  const ambiguous = position.legalMoves().some((other) => movePiece(other) === piece && moveTo(other) === to && moveFrom(other) !== from);
  position.make(move);
  const check = position.inCheck();
  const mate = check && !position.hasLegalMove();
  position.unmake(move);
  return {
    piece,
    from,
    to,
    captured,
    enPassant: flag === FLAG_EN_PASSANT,
    promotion: movePromotion(move),
    castle: flag === FLAG_CASTLE_KING ? "king" : flag === FLAG_CASTLE_QUEEN ? "queen" : null,
    ambiguous,
    recapture: after !== undefined && captured !== 0 && flag !== FLAG_EN_PASSANT && moveTo(after) === to,
    check,
    mate,
  };
}

/** The position the opponent's opening move was played in. */
export function positionBeforeSetup(puzzle: ResolvedPuzzle): Position {
  return Position.fromFen(puzzle.fen);
}

/** Moves the solver has to find. */
export const solverMoves = (puzzle: ResolvedPuzzle): number => (puzzle.line.length + 1) / 2;

/** The first of a puzzle's themes that has a hint written for it. */
export function themeHint(puzzle: ResolvedPuzzle, hints: Partial<Record<ChessTheme, string>>): string | undefined {
  return puzzle.shape.themes.map((theme) => hints[theme]).find((text) => text !== undefined);
}

/** Picks one of several wordings. `variant` is a counter kept by the caller, so the choice is repeatable. */
export const pick = (options: readonly string[], variant: number): string => options[((variant % options.length) + options.length) % options.length];

export const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
