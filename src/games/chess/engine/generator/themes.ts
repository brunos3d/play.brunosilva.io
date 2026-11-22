import { BISHOP, KING, KNIGHT, type Move, type Position, QUEEN, ROOK, attackedFrom, moveCaptured, moveFrom, movePiece, movePromotion, moveTo, opposite, pieceColor, pieceType, rankOf, squaresBetween } from "../position";
import { PIECE_VALUE } from "../search";
import type { ChessTheme, PuzzleKind } from "../types";

/** A solver move, before the last one, that gives up more than it takes and is captured at once. */
export function hasSacrifice(line: readonly Move[]): boolean {
  for (let index = 0; index + 1 < line.length; index += 2) {
    const given = PIECE_VALUE[movePromotion(line[index]) || movePiece(line[index])];
    if (moveTo(line[index + 1]) === moveTo(line[index]) && given > PIECE_VALUE[moveCaptured(line[index])] + 100) return true;
  }
  return false;
}

/**
 * Names the ideas in a solution. `position` is the puzzle position with the
 * solver to move, and it is left as it was. The list is ordered from the most
 * telling theme to the least, and the coach words its hint after the first one.
 */
export function tagThemes(position: Position, line: readonly Move[], kind: PuzzleKind, mateIn: number): ChessTheme[] {
  const themes: ChessTheme[] = [];
  const solver = position.side;
  const enemy = opposite(solver);
  const first = line[0];

  if (kind === "defence") themes.push("defensiveMove");

  if (hasSacrifice(line)) themes.push("sacrifice");

  if (kind === "advantage") {
    position.make(first);
    const to = moveTo(first);
    const mover = PIECE_VALUE[pieceType(position.board[to])];
    const worthTaking = (square: number): boolean => {
      const piece = position.board[square];
      if (piece === 0 || pieceColor(piece) !== enemy) return false;
      const type = pieceType(piece);
      return type === KING || PIECE_VALUE[type] > mover || !position.isAttacked(square, enemy);
    };
    const forked = attackedFrom(position, to).filter(worthTaking);
    // The moved piece has to survive for its threats to count.
    const safe = !position.isAttacked(to, enemy) || position.isAttacked(to, solver);
    if (line.length > 1 && forked.length >= 2 && safe) themes.push("fork");

    // Discovered attack: a line piece behind the moved one now hits something big through the square it left.
    const from = moveFrom(first);
    for (let square = 0; square < 64 && !themes.includes("discoveredAttack"); square++) {
      const piece = position.board[square];
      if (piece === 0 || pieceColor(piece) !== solver || square === to) continue;
      const type = pieceType(piece);
      if (type !== BISHOP && type !== ROOK && type !== QUEEN) continue;
      for (const target of attackedFrom(position, square)) {
        const hit = position.board[target];
        if (hit === 0 || pieceColor(hit) !== enemy || !squaresBetween(square, target).includes(from)) continue;
        if (pieceType(hit) === KING || PIECE_VALUE[pieceType(hit)] >= PIECE_VALUE[ROOK] || !position.isAttacked(target, enemy)) {
          themes.push("discoveredAttack");
          break;
        }
      }
    }
    if (line.length === 1 && moveCaptured(first) !== 0 && !position.isAttacked(to, enemy)) themes.push("hangingPiece");
    position.unmake(first);
  }

  if (line.some((move, index) => index % 2 === 0 && movePromotion(move) !== 0)) themes.push("promotion");

  if (kind === "mate") {
    for (const move of line) position.make(move);
    const king = position.kings[enemy];
    const last = line[line.length - 1];
    const mating = pieceType(position.board[moveTo(last)]);
    const homeRank = enemy === 0 ? 0 : 7;
    if (rankOf(king) === homeRank && (mating === ROOK || mating === QUEEN) && rankOf(moveTo(last)) === homeRank) themes.push("backRankMate");
    const boxedIn = attackedFrom(position, king).every((square) => position.board[square] !== 0 && pieceColor(position.board[square]) === enemy);
    if (mating === KNIGHT && boxedIn) themes.push("smotheredMate");
    for (let index = line.length - 1; index >= 0; index--) position.unmake(line[index]);
    themes.push(mateIn === 1 ? "mateIn1" : mateIn === 2 ? "mateIn2" : "mateIn3");
  }

  return themes;
}
