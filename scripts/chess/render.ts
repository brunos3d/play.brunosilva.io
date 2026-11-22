import { Position, WHITE, pieceColor, pieceType } from "@/games/chess/engine";

const GLYPHS = " PNBRQK";

/** The board as text, White at the bottom: capitals are White, lower case is Black. */
export function renderPosition(position: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = `${rank + 1} `;
    for (let file = 0; file < 8; file++) {
      const piece = position.board[rank * 8 + file];
      const glyph = piece === 0 ? "." : GLYPHS[pieceType(piece)];
      row += ` ${piece !== 0 && pieceColor(piece) !== WHITE ? glyph.toLowerCase() : glyph}`;
    }
    rows.push(row);
  }
  rows.push("   a b c d e f g h");
  return rows.join("\n");
}
