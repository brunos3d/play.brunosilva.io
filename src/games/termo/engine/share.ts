import { scoreGuess, solvedAt } from "./rules";
import type { LetterMark, TermoShape } from "./types";

const SQUARE: Record<LetterMark, string> = { right: "🟩", place: "🟨", wrong: "⬛" };
const BLANK = "⬜⬜⬜⬜⬜";

/**
 * The guesses as coloured squares, without letters, for sharing. One block per
 * board. Two boards sit side by side, as Dueto shares them, and four boards
 * make two such pairs. The first line says how many guesses each word took.
 *
 *   3/6
 *   ⬛🟨⬛⬛⬛
 *   🟩⬛🟨⬛🟩
 *   🟩🟩🟩🟩🟩
 */
export function termoShareGrid(shape: TermoShape, guesses: readonly string[]): string {
  const blocks = shape.answers.map((answer) => {
    const end = solvedAt(answer, guesses);
    const played = end === -1 ? guesses : guesses.slice(0, end + 1);
    return { took: end === -1 ? "X" : String(end + 1), rows: played.map((guess) => scoreGuess(answer, guess).map((mark) => SQUARE[mark]).join("")) };
  });
  const lines = [blocks.map((block) => `${block.took}/${shape.maxGuesses}`).join(" ")];
  for (let first = 0; first < blocks.length; first += 2) {
    const pair = blocks.slice(first, first + 2);
    const height = Math.max(...pair.map((block) => block.rows.length));
    if (first > 0) lines.push("");
    for (let row = 0; row < height; row++) lines.push(pair.map((block) => block.rows[row] ?? BLANK).join(" "));
  }
  return lines.join("\n");
}
