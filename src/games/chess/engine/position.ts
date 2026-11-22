/**
 * Chess position with move generation, make and unmake.
 *
 * Written for the puzzle generator's search, which visits a few hundred
 * thousand positions per puzzle in the browser: one flat board, moves packed
 * into integers, and an undo stack instead of copies.
 *
 * Squares run from a1 = 0 to h8 = 63, so `file = square & 7` and
 * `rank = square >> 3`. A piece is `type | (colour << 3)`, and 0 is an empty
 * square.
 */
import { PIECE_VALUE, PLACED } from "./tables";

export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export type PieceType = 1 | 2 | 3 | 4 | 5 | 6;

export const pieceType = (piece: number): number => piece & 7;
export const pieceColor = (piece: number): Color => (piece >> 3) as Color;
export const makePiece = (color: Color, type: number): number => type | (color << 3);
export const fileOf = (square: number): number => square & 7;
export const rankOf = (square: number): number => square >> 3;
export const opposite = (color: Color): Color => (color ^ 1) as Color;

/**
 * A move is one integer:
 *
 *   bits 0-5 from, 6-11 to, 12-14 promotion piece, 15-17 flag,
 *   18-20 captured piece type, 21-23 moving piece type.
 *
 * The captured and moving types are redundant with the board, but having them
 * in the move lets the search order moves and the coach describe them without
 * the position at hand.
 */
export type Move = number;

export const FLAG_NONE = 0;
export const FLAG_DOUBLE_PUSH = 1;
export const FLAG_EN_PASSANT = 2;
export const FLAG_CASTLE_KING = 3;
export const FLAG_CASTLE_QUEEN = 4;

export const moveFrom = (move: Move): number => move & 63;
export const moveTo = (move: Move): number => (move >> 6) & 63;
export const movePromotion = (move: Move): number => (move >> 12) & 7;
export const moveFlag = (move: Move): number => (move >> 15) & 7;
export const moveCaptured = (move: Move): number => (move >> 18) & 7;
export const movePiece = (move: Move): number => (move >> 21) & 7;

const pack = (from: number, to: number, piece: number, captured: number, promotion: number, flag: number): Move =>
  from | (to << 6) | (promotion << 12) | (flag << 15) | (captured << 18) | (piece << 21);

// ---------- Geometry, computed once ----------

/** Squares a knight on each square can reach. */
const KNIGHT_TARGETS: number[][] = [];
const KING_TARGETS: number[][] = [];
/** RAYS[square * 8 + direction]: squares in that direction, nearest first. Directions 0-3 are rook lines, 4-7 bishop lines. */
const RAYS: number[][] = [];
const DIRECTIONS: readonly (readonly [number, number])[] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_JUMPS: readonly (readonly [number, number])[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

for (let square = 0; square < 64; square++) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const onBoard = (f: number, r: number): boolean => f >= 0 && f < 8 && r >= 0 && r < 8;
  KNIGHT_TARGETS.push(KNIGHT_JUMPS.filter(([df, dr]) => onBoard(file + df, rank + dr)).map(([df, dr]) => (rank + dr) * 8 + file + df));
  KING_TARGETS.push(DIRECTIONS.filter(([df, dr]) => onBoard(file + df, rank + dr)).map(([df, dr]) => (rank + dr) * 8 + file + df));
  for (const [df, dr] of DIRECTIONS) {
    const ray: number[] = [];
    for (let f = file + df, r = rank + dr; onBoard(f, r); f += df, r += dr) ray.push(r * 8 + f);
    RAYS.push(ray);
  }
}

/** LINE[a * 64 + b]: 1 when the squares share a rank or a file, 2 when they share a diagonal, 0 otherwise. A piece that shares no line with its king cannot be pinned. */
const LINE = new Uint8Array(64 * 64);
/** KNIGHT_LINK[a * 64 + b]: a knight jumps between the two squares. */
const KNIGHT_LINK = new Uint8Array(64 * 64);
for (let square = 0; square < 64; square++) {
  for (let direction = 0; direction < 8; direction++) for (const target of RAYS[square * 8 + direction]) LINE[square * 64 + target] = direction < 4 ? 1 : 2;
  for (const target of KNIGHT_TARGETS[square]) KNIGHT_LINK[square * 64 + target] = 1;
}

const CASTLE_WHITE_KING = 1;
const CASTLE_WHITE_QUEEN = 2;
const CASTLE_BLACK_KING = 4;
const CASTLE_BLACK_QUEEN = 8;

/** Castling rights that survive a move touching each square. A move from or to a rook's or king's home square clears its rights. */
const CASTLE_KEEP = new Uint8Array(64).fill(15);
CASTLE_KEEP[0] = 15 & ~CASTLE_WHITE_QUEEN;
CASTLE_KEEP[4] = 15 & ~(CASTLE_WHITE_KING | CASTLE_WHITE_QUEEN);
CASTLE_KEEP[7] = 15 & ~CASTLE_WHITE_KING;
CASTLE_KEEP[56] = 15 & ~CASTLE_BLACK_QUEEN;
CASTLE_KEEP[60] = 15 & ~(CASTLE_BLACK_KING | CASTLE_BLACK_QUEEN);
CASTLE_KEEP[63] = 15 & ~CASTLE_BLACK_KING;

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FEN_PIECES = " PNBRQK  pnbrqk";
const PROMOTIONS = [QUEEN, KNIGHT, ROOK, BISHOP] as const;

export class Position {
  readonly board = new Int8Array(64);
  side: Color = WHITE;
  /** Bit set: 1 white short, 2 white long, 4 black short, 8 black long. */
  castling = 0;
  /** Square a pawn just skipped, or -1. */
  enPassant = -1;
  halfmove = 0;
  fullmove = 1;
  readonly kings = new Int8Array(2);
  /** Material plus placement of everything but the kings, White minus Black. `make` and `unmake` keep it current. */
  placement = 0;
  /** Material of each side without pawns and king. It decides when the kings start walking to the centre. */
  readonly pieceMaterial = new Int32Array(2);
  /** Four entries per move made: captured piece, castling rights, en passant square, halfmove clock. */
  private readonly undo: number[] = [];

  static fromFen(fen: string): Position {
    const position = new Position();
    const [placement, side, castling, enPassant, halfmove, fullmove] = fen.trim().split(/\s+/);
    const ranks = placement.split("/");
    if (ranks.length !== 8) throw new RangeError(`Invalid FEN: ${fen}`);
    for (let index = 0; index < 8; index++) {
      let file = 0;
      for (const char of ranks[index]) {
        if (char >= "1" && char <= "8") {
          file += Number(char);
          continue;
        }
        const piece = FEN_PIECES.indexOf(char);
        if (piece < 1 || file > 7) throw new RangeError(`Invalid FEN: ${fen}`);
        const square = (7 - index) * 8 + file++;
        position.put(square, piece);
        if (pieceType(piece) === KING) position.kings[pieceColor(piece)] = square;
      }
      if (file !== 8) throw new RangeError(`Invalid FEN: ${fen}`);
    }
    position.side = side === "b" ? BLACK : WHITE;
    for (const char of castling ?? "-") {
      const bit = { K: CASTLE_WHITE_KING, Q: CASTLE_WHITE_QUEEN, k: CASTLE_BLACK_KING, q: CASTLE_BLACK_QUEEN }[char];
      if (bit) position.castling |= bit;
    }
    position.enPassant = enPassant && enPassant !== "-" ? squareFromName(enPassant) : -1;
    position.halfmove = Number(halfmove ?? 0) || 0;
    position.fullmove = Number(fullmove ?? 1) || 1;
    return position;
  }

  toFen(): string {
    const ranks: string[] = [];
    for (let rank = 7; rank >= 0; rank--) {
      let text = "";
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = this.board[rank * 8 + file];
        if (piece === 0) {
          empty++;
          continue;
        }
        if (empty > 0) text += empty;
        empty = 0;
        text += FEN_PIECES[piece];
      }
      ranks.push(empty > 0 ? text + empty : text);
    }
    const rights = `${this.castling & 1 ? "K" : ""}${this.castling & 2 ? "Q" : ""}${this.castling & 4 ? "k" : ""}${this.castling & 8 ? "q" : ""}` || "-";
    const enPassant = this.enPassant >= 0 ? squareName(this.enPassant) : "-";
    return `${ranks.join("/")} ${this.side === WHITE ? "w" : "b"} ${rights} ${enPassant} ${this.halfmove} ${this.fullmove}`;
  }

  clone(): Position {
    const copy = new Position();
    copy.board.set(this.board);
    copy.side = this.side;
    copy.castling = this.castling;
    copy.enPassant = this.enPassant;
    copy.halfmove = this.halfmove;
    copy.fullmove = this.fullmove;
    copy.kings.set(this.kings);
    copy.placement = this.placement;
    copy.pieceMaterial.set(this.pieceMaterial);
    return copy;
  }

  private put(square: number, piece: number): void {
    this.board[square] = piece;
    this.placement += PLACED[piece * 64 + square];
    const type = piece & 7;
    if (type !== PAWN) this.pieceMaterial[piece >> 3] += PIECE_VALUE[type];
  }

  private lift(square: number): number {
    const piece = this.board[square];
    this.board[square] = 0;
    this.placement -= PLACED[piece * 64 + square];
    const type = piece & 7;
    if (type !== PAWN) this.pieceMaterial[piece >> 3] -= PIECE_VALUE[type];
    return piece;
  }

  /** True when a pawn of colour `by` attacks the square. */
  isAttackedByPawn(square: number, by: Color): boolean {
    const board = this.board;
    const file = square & 7;
    if (by === WHITE) return (file > 0 && square >= 9 && board[square - 9] === PAWN) || (file < 7 && square >= 7 && board[square - 7] === PAWN);
    return (file > 0 && square <= 56 && board[square + 7] === (PAWN | 8)) || (file < 7 && square <= 54 && board[square + 9] === (PAWN | 8));
  }

  /** True when a piece of colour `by` attacks the square. */
  isAttacked(square: number, by: Color): boolean {
    const board = this.board;
    const file = square & 7;
    // A white pawn attacks upward, so it sits one rank below the square. A black pawn sits one rank above.
    if (by === WHITE) {
      if (file > 0 && square >= 9 && board[square - 9] === PAWN) return true;
      if (file < 7 && square >= 7 && board[square - 7] === PAWN) return true;
    } else {
      if (file > 0 && square <= 56 && board[square + 7] === (PAWN | 8)) return true;
      if (file < 7 && square <= 54 && board[square + 9] === (PAWN | 8)) return true;
    }
    const tint = by << 3;
    const knight = KNIGHT | tint;
    for (const target of KNIGHT_TARGETS[square]) if (board[target] === knight) return true;
    const king = KING | tint;
    for (const target of KING_TARGETS[square]) if (board[target] === king) return true;
    const queen = QUEEN | tint;
    const rook = ROOK | tint;
    const bishop = BISHOP | tint;
    const base = square * 8;
    for (let direction = 0; direction < 8; direction++) {
      const slider = direction < 4 ? rook : bishop;
      for (const target of RAYS[base + direction]) {
        const piece = board[target];
        if (piece === 0) continue;
        if (piece === slider || piece === queen) return true;
        break;
      }
    }
    return false;
  }

  /** The side to move is in check. */
  inCheck(): boolean {
    return this.isAttacked(this.kings[this.side], opposite(this.side));
  }

  /**
   * Appends pseudo-legal moves: they follow how the pieces move, but may leave
   * the mover's king in check. `capturesOnly` keeps captures and queen
   * promotions, which is what the quiescence search looks at.
   */
  pseudoMoves(out: Move[], capturesOnly = false): void {
    const board = this.board;
    const side = this.side;
    const enemy = opposite(side);
    for (let from = 0; from < 64; from++) {
      const piece = board[from];
      if (piece === 0 || piece >> 3 !== side) continue;
      const type = piece & 7;

      if (type === PAWN) {
        const forward = side === WHITE ? 8 : -8;
        const rank = from >> 3;
        const promoting = rank === (side === WHITE ? 6 : 1);
        const file = from & 7;
        const ahead = from + forward;
        if (board[ahead] === 0) {
          if (promoting) {
            for (const promotion of PROMOTIONS) {
              if (capturesOnly && promotion !== QUEEN) break;
              out.push(pack(from, ahead, PAWN, 0, promotion, FLAG_NONE));
            }
          } else if (!capturesOnly) {
            out.push(pack(from, ahead, PAWN, 0, 0, FLAG_NONE));
            if (rank === (side === WHITE ? 1 : 6) && board[ahead + forward] === 0) out.push(pack(from, ahead + forward, PAWN, 0, 0, FLAG_DOUBLE_PUSH));
          }
        }
        for (let sideways = -1; sideways <= 1; sideways += 2) {
          const targetFile = file + sideways;
          if (targetFile < 0 || targetFile > 7) continue;
          const to = ahead + sideways;
          const target = board[to];
          if (target !== 0 && target >> 3 === enemy) {
            if (promoting) for (const promotion of PROMOTIONS) out.push(pack(from, to, PAWN, target & 7, promotion, FLAG_NONE));
            else out.push(pack(from, to, PAWN, target & 7, 0, FLAG_NONE));
          } else if (to === this.enPassant && target === 0) {
            out.push(pack(from, to, PAWN, PAWN, 0, FLAG_EN_PASSANT));
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        for (const to of type === KNIGHT ? KNIGHT_TARGETS[from] : KING_TARGETS[from]) {
          const target = board[to];
          if (target === 0) {
            if (!capturesOnly) out.push(pack(from, to, type, 0, 0, FLAG_NONE));
          } else if (target >> 3 === enemy) {
            out.push(pack(from, to, type, target & 7, 0, FLAG_NONE));
          }
        }
        if (type === KING && !capturesOnly) this.castlingMoves(out, from);
        continue;
      }

      const first = type === BISHOP ? 4 : 0;
      const last = type === ROOK ? 4 : 8;
      for (let direction = first; direction < last; direction++) {
        for (const to of RAYS[from * 8 + direction]) {
          const target = board[to];
          if (target === 0) {
            if (!capturesOnly) out.push(pack(from, to, type, 0, 0, FLAG_NONE));
            continue;
          }
          if (target >> 3 === enemy) out.push(pack(from, to, type, target & 7, 0, FLAG_NONE));
          break;
        }
      }
    }
  }

  /** The king may not castle out of check or through an attacked square. The landing square is covered by the usual legality test. */
  private castlingMoves(out: Move[], from: number): void {
    const side = this.side;
    const home = side === WHITE ? 4 : 60;
    if (from !== home) return;
    const board = this.board;
    const enemy = opposite(side);
    const short = side === WHITE ? CASTLE_WHITE_KING : CASTLE_BLACK_KING;
    const long = side === WHITE ? CASTLE_WHITE_QUEEN : CASTLE_BLACK_QUEEN;
    const rook = makePiece(side, ROOK);
    if (this.castling & short && board[home + 1] === 0 && board[home + 2] === 0 && board[home + 3] === rook && !this.isAttacked(home, enemy) && !this.isAttacked(home + 1, enemy)) {
      out.push(pack(home, home + 2, KING, 0, 0, FLAG_CASTLE_KING));
    }
    if (this.castling & long && board[home - 1] === 0 && board[home - 2] === 0 && board[home - 3] === 0 && board[home - 4] === rook && !this.isAttacked(home, enemy) && !this.isAttacked(home - 1, enemy)) {
      out.push(pack(home, home - 2, KING, 0, 0, FLAG_CASTLE_QUEEN));
    }
  }

  /**
   * Every legal move for the side to move. Most moves need no test: with the
   * king not in check, a piece that does not share a line with it cannot expose
   * it. Only king moves, en passant, moves along the king's lines and moves
   * made in check are played out and checked. A caller that already knows
   * whether the side is in check passes it in and saves the test.
   */
  legalMoves(capturesOnly = false, inCheck = this.inCheck()): Move[] {
    const pseudo: Move[] = [];
    this.pseudoMoves(pseudo, capturesOnly);
    const side = this.side;
    const enemy = opposite(side);
    const king = this.kings[side];
    const aligned = king * 64;
    let count = 0;
    for (const move of pseudo) {
      const from = move & 63;
      if (inCheck || from === king || LINE[aligned + from] !== 0 || ((move >> 15) & 7) === FLAG_EN_PASSANT) {
        this.make(move);
        const exposed = this.isAttacked(this.kings[side], enemy);
        this.unmake(move);
        if (exposed) continue;
      }
      pseudo[count++] = move;
    }
    pseudo.length = count;
    return pseudo;
  }

  hasLegalMove(): boolean {
    const pseudo: Move[] = [];
    this.pseudoMoves(pseudo);
    const side = this.side;
    const enemy = opposite(side);
    const king = this.kings[side];
    const inCheck = this.isAttacked(king, enemy);
    const aligned = king * 64;
    for (const move of pseudo) {
      const from = move & 63;
      if (!inCheck && from !== king && LINE[aligned + from] === 0 && ((move >> 15) & 7) !== FLAG_EN_PASSANT) return true;
      this.make(move);
      const exposed = this.isAttacked(this.kings[side], enemy);
      this.unmake(move);
      if (!exposed) return true;
    }
    return false;
  }

  /**
   * False when the move cannot possibly give check, decided from geometry alone.
   * True means "play it and look". The mate search uses it to skip most moves
   * without touching the board.
   */
  mayGiveCheck(move: Move): boolean {
    const flag = (move >> 15) & 7;
    if (flag >= FLAG_EN_PASSANT) return true;
    const king = this.kings[opposite(this.side)] * 64;
    // The square it leaves is on a line with the king: something behind it may now give check.
    if (LINE[king + (move & 63)] !== 0) return true;
    const to = (move >> 6) & 63;
    const piece = (move >> 12) & 7 || (move >> 21) & 7;
    if (piece === KNIGHT) return KNIGHT_LINK[king + to] === 1;
    if (piece === ROOK) return LINE[king + to] === 1;
    if (piece === BISHOP) return LINE[king + to] === 2;
    if (piece === QUEEN) return LINE[king + to] !== 0;
    if (piece === PAWN) return LINE[king + to] === 2;
    return false;
  }

  /** Plays a move the generator produced. It does not check legality. */
  make(move: Move): void {
    const side = this.side;
    const from = move & 63;
    const to = (move >> 6) & 63;
    const promotion = (move >> 12) & 7;
    const flag = (move >> 15) & 7;
    const captured = this.board[to];
    this.undo.push(captured, this.castling, this.enPassant, this.halfmove);

    if (captured !== 0) this.lift(to);
    const piece = this.lift(from);
    this.put(to, promotion ? makePiece(side, promotion) : piece);
    if (flag === FLAG_EN_PASSANT) this.lift(to + (side === WHITE ? -8 : 8));
    else if (flag === FLAG_CASTLE_KING) this.put(from + 1, this.lift(from + 3));
    else if (flag === FLAG_CASTLE_QUEEN) this.put(from - 1, this.lift(from - 4));
    if ((piece & 7) === KING) this.kings[side] = to;

    this.castling &= CASTLE_KEEP[from] & CASTLE_KEEP[to];
    this.enPassant = flag === FLAG_DOUBLE_PUSH ? (from + to) >> 1 : -1;
    this.halfmove = (piece & 7) === PAWN || captured !== 0 ? 0 : this.halfmove + 1;
    if (side === BLACK) this.fullmove++;
    this.side = opposite(side);
  }

  unmake(move: Move): void {
    const side = opposite(this.side);
    const from = move & 63;
    const to = (move >> 6) & 63;
    const flag = (move >> 15) & 7;
    const undo = this.undo;
    this.halfmove = undo.pop()!;
    this.enPassant = undo.pop()!;
    this.castling = undo.pop()!;
    const captured = undo.pop()!;

    const moved = this.lift(to);
    const piece = (move >> 12) & 7 ? makePiece(side, PAWN) : moved;
    this.put(from, piece);
    if (captured !== 0) this.put(to, captured);
    if (flag === FLAG_EN_PASSANT) this.put(to + (side === WHITE ? -8 : 8), makePiece(opposite(side), PAWN));
    else if (flag === FLAG_CASTLE_KING) this.put(from + 3, this.lift(from + 1));
    else if (flag === FLAG_CASTLE_QUEEN) this.put(from - 4, this.lift(from - 1));
    if ((piece & 7) === KING) this.kings[side] = from;
    if (side === BLACK) this.fullmove--;
    this.side = side;
  }
}

/** Squares strictly between two squares on one line, or an empty list when they share none. */
export function squaresBetween(a: number, b: number): number[] {
  for (let direction = 0; direction < 8; direction++) {
    const ray = RAYS[a * 8 + direction];
    const index = ray.indexOf(b);
    if (index >= 0) return ray.slice(0, index);
  }
  return [];
}

/** Squares a piece standing on `square` attacks, with the board as it is. Pawns attack diagonally whether or not something is there. */
export function attackedFrom(position: Position, square: number): number[] {
  const piece = position.board[square];
  if (piece === 0) return [];
  const type = piece & 7;
  const color = pieceColor(piece);
  if (type === KNIGHT) return KNIGHT_TARGETS[square];
  if (type === KING) return KING_TARGETS[square];
  if (type === PAWN) {
    const ahead = square + (color === WHITE ? 8 : -8);
    return [-1, 1].filter((sideways) => fileOf(square) + sideways >= 0 && fileOf(square) + sideways <= 7 && ahead >= 0 && ahead < 64).map((sideways) => ahead + sideways);
  }
  const targets: number[] = [];
  const first = type === BISHOP ? 4 : 0;
  const last = type === ROOK ? 4 : 8;
  for (let direction = first; direction < last; direction++) {
    for (const to of RAYS[square * 8 + direction]) {
      targets.push(to);
      if (position.board[to] !== 0) break;
    }
  }
  return targets;
}

export function squareName(square: number): string {
  return "abcdefgh"[fileOf(square)] + (rankOf(square) + 1);
}

export function squareFromName(name: string): number {
  const file = name.charCodeAt(0) - 97;
  const rank = name.charCodeAt(1) - 49;
  if (name.length !== 2 || file < 0 || file > 7 || rank < 0 || rank > 7) throw new RangeError(`Invalid square: ${name}`);
  return rank * 8 + file;
}

const UCI_PROMOTION = ["", "", "n", "b", "r", "q"];

/** Long algebraic form, the one stored in puzzles: `e2e4`, `e7e8q`. */
export function moveToUci(move: Move): string {
  return squareName(moveFrom(move)) + squareName(moveTo(move)) + UCI_PROMOTION[movePromotion(move)];
}

/** Finds the legal move a UCI string names, or 0 when the position has none. A pawn reaching the last rank without a letter promotes to a queen. */
export function moveFromUci(position: Position, uci: string): Move {
  const from = squareFromName(uci.slice(0, 2));
  const to = squareFromName(uci.slice(2, 4));
  const promotion = Math.max(0, UCI_PROMOTION.indexOf(uci[4] ?? "")) || 0;
  for (const move of position.legalMoves()) {
    if (moveFrom(move) !== from || moveTo(move) !== to) continue;
    const wanted = movePromotion(move);
    if (wanted === 0 || wanted === (promotion || QUEEN)) return move;
  }
  return 0;
}
