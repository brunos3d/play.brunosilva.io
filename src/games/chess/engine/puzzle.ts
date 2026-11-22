import { type Color, FLAG_CASTLE_KING, FLAG_CASTLE_QUEEN, FLAG_EN_PASSANT, type Move, Position, WHITE, moveFlag, moveFrom, moveFromUci, moveTo, pieceColor, pieceType } from "./position";
import { isCheckmate } from "./search";
import type { ChessShape } from "./types";

/** A puzzle with its moves resolved against the board, ready for the game state and the UI. */
export type ResolvedPuzzle = {
  shape: ChessShape;
  /** Starting position, before the opponent's move. */
  fen: string;
  solver: Color;
  setup: Move;
  /** Solver, opponent, solver, and so on. */
  line: readonly Move[];
};

/** Reads a puzzle's moves and checks that each one is legal where it is played. Throws on a puzzle that does not hold together. */
export function resolvePuzzle(shape: ChessShape): ResolvedPuzzle {
  const position = Position.fromFen(shape.fen);
  const setup = moveFromUci(position, shape.setup);
  if (setup === 0) throw new RangeError(`Illegal opening move ${shape.setup}`);
  position.make(setup);
  const solver = position.side;
  if ((solver === WHITE ? "white" : "black") !== shape.solver) throw new RangeError("The puzzle names the wrong side to move.");
  const line: Move[] = [];
  for (const uci of shape.line) {
    const move = moveFromUci(position, uci);
    if (move === 0) throw new RangeError(`Illegal solution move ${uci}`);
    line.push(move);
    position.make(move);
  }
  if (line.length === 0 || line.length % 2 === 0) throw new RangeError("A solution ends on a solver move.");
  return { shape, fen: shape.fen, solver, setup, line };
}

/** The position after the opening move and the given moves. A fresh object every time, so callers may search it freely. */
export function positionAfter(puzzle: ResolvedPuzzle, moves: readonly Move[]): Position {
  const position = Position.fromFen(puzzle.fen);
  position.make(puzzle.setup);
  for (const move of moves) position.make(move);
  return position;
}

/** A piece on the board with an identity that survives moves, so the UI can slide the same element from square to square. */
export type BoardPiece = { id: number; type: number; color: Color; square: number };

export type BoardView = {
  pieces: BoardPiece[];
  /** Side to move. */
  turn: Color;
  /** Square of the king in check, or -1. */
  checkSquare: number;
  checkmate: boolean;
  /** Last move played, as [from, to], or null on the starting position. */
  lastMove: [number, number] | null;
};

/**
 * Replays moves from a FEN and tracks every piece by the square it started on.
 * A capture drops the captured piece, castling moves the rook too, and a
 * promoted pawn keeps its identity and changes its type.
 */
export function boardView(fen: string, moves: readonly Move[]): BoardView {
  const position = Position.fromFen(fen);
  const idAt = new Int16Array(64).fill(-1);
  for (let square = 0; square < 64; square++) if (position.board[square] !== 0) idAt[square] = square;

  for (const move of moves) {
    const from = moveFrom(move);
    const to = moveTo(move);
    const flag = moveFlag(move);
    const side = position.side;
    position.make(move);
    idAt[to] = idAt[from];
    idAt[from] = -1;
    if (flag === FLAG_EN_PASSANT) idAt[to + (side === WHITE ? -8 : 8)] = -1;
    else if (flag === FLAG_CASTLE_KING) {
      idAt[from + 1] = idAt[from + 3];
      idAt[from + 3] = -1;
    } else if (flag === FLAG_CASTLE_QUEEN) {
      idAt[from - 1] = idAt[from - 4];
      idAt[from - 4] = -1;
    }
  }

  const pieces: BoardPiece[] = [];
  for (let square = 0; square < 64; square++) {
    const piece = position.board[square];
    if (piece !== 0) pieces.push({ id: idAt[square], type: pieceType(piece), color: pieceColor(piece), square });
  }
  pieces.sort((a, b) => a.id - b.id);
  const inCheck = position.inCheck();
  const last = moves[moves.length - 1];
  return {
    pieces,
    turn: position.side,
    checkSquare: inCheck ? position.kings[position.side] : -1,
    checkmate: inCheck && isCheckmate(position),
    lastMove: last === undefined ? null : [moveFrom(last), moveTo(last)],
  };
}
