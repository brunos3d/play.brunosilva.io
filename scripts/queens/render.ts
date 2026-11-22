import type { QueensPuzzle } from "@/games/queens/engine";

/** ASCII board: one letter per region. With `solution`, the queen of each row is marked with an asterisk. */
export function renderQueens(puzzle: QueensPuzzle, solution: boolean): string {
  const queens = new Set(puzzle.solution);
  const lines: string[] = [];
  for (let row = 0; row < puzzle.size; row++) {
    let line = "";
    for (let column = 0; column < puzzle.size; column++) {
      const cell = row * puzzle.size + column;
      line += ` ${String.fromCharCode(65 + puzzle.regions[cell])}${solution && queens.has(cell) ? "*" : " "}`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
