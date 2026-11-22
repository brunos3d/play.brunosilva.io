import { FLAG_CASTLE_KING, FLAG_CASTLE_QUEEN, KING, type Move, PAWN, type Position, fileOf, moveCaptured, moveFlag, moveFrom, movePiece, movePromotion, moveTo, rankOf, squareName } from "./position";

/** Piece letters, indexed by piece type. Pawns have none. */
export const LETTERS_EN: readonly string[] = ["", "", "N", "B", "R", "Q", "K"];
/** Portuguese letters: Cavalo, Bispo, Torre, Dama, Rei. */
export const LETTERS_PT: readonly string[] = ["", "", "C", "B", "T", "D", "R"];

/**
 * Standard algebraic notation for a legal move in this position: `Nf3`, `exd5`,
 * `O-O`, `e8=Q+`, `Qh7#`. The position is used to disambiguate and to add the
 * check or mate sign, and it is left as it was.
 */
export function toSan(position: Position, move: Move, letters: readonly string[] = LETTERS_EN): string {
  const flag = moveFlag(move);
  let text: string;
  if (flag === FLAG_CASTLE_KING) text = "O-O";
  else if (flag === FLAG_CASTLE_QUEEN) text = "O-O-O";
  else {
    const piece = movePiece(move);
    const from = moveFrom(move);
    const to = moveTo(move);
    const capture = moveCaptured(move) !== 0;
    if (piece === PAWN) {
      text = capture ? `${"abcdefgh"[fileOf(from)]}x` : "";
    } else {
      // Another piece of the same kind that could also go there: name the file, or the rank, or both.
      const rivals = position.legalMoves().filter((other) => other !== move && movePiece(other) === piece && moveTo(other) === to && moveFrom(other) !== from);
      let origin = "";
      if (rivals.length > 0 && piece !== KING) {
        const sameFile = rivals.some((other) => fileOf(moveFrom(other)) === fileOf(from));
        const sameRank = rivals.some((other) => rankOf(moveFrom(other)) === rankOf(from));
        origin = !sameFile ? "abcdefgh"[fileOf(from)] : !sameRank ? String(rankOf(from) + 1) : squareName(from);
      }
      text = `${letters[piece]}${origin}${capture ? "x" : ""}`;
    }
    text += squareName(to);
    if (movePromotion(move)) text += `=${letters[movePromotion(move)]}`;
  }

  position.make(move);
  if (position.inCheck()) text += position.hasLegalMove() ? "+" : "#";
  position.unmake(move);
  return text;
}

/** Numbered line starting from this position: `1. Qh7+ Kxh7 2. Rh3#`, or `1... Qxb2 2. Rd8#` when Black moves first. */
export function lineToSan(position: Position, moves: readonly Move[], letters: readonly string[] = LETTERS_EN): string {
  const parts: string[] = [];
  let number = position.fullmove;
  moves.forEach((move, index) => {
    const whiteToMove = position.side === 0;
    if (whiteToMove) parts.push(`${number}.`);
    else if (index === 0) parts.push(`${number}...`);
    parts.push(toSan(position, move, letters));
    if (!whiteToMove) number++;
    position.make(move);
  });
  for (let index = moves.length - 1; index >= 0; index--) position.unmake(moves[index]);
  return parts.join(" ");
}
