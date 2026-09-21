import { type ZipPuzzle, wallKey } from "@/games/zip/engine";

/** ASCII board. With `solution`, each cell shows its position on the path and numbered cells get brackets. */
export function renderZip(puzzle: ZipPuzzle, solution: boolean): string {
  const { width, height } = puzzle;
  const walls = new Set(puzzle.walls.map((wall) => wallKey(wall.a, wall.b)));
  const numberAt = new Map(puzzle.checkpoints.map((checkpoint) => [checkpoint.row * width + checkpoint.column, checkpoint.number]));
  const orderAt = new Map(puzzle.solution.map((cell, order) => [cell, order + 1]));
  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    let line = "";
    let below = "";
    for (let column = 0; column < width; column++) {
      const cell = row * width + column;
      const number = numberAt.get(cell);
      const text = solution ? (number ? `[${orderAt.get(cell)}]` : String(orderAt.get(cell))) : number ? String(number) : ".";
      line += text.padStart(4) + (column < width - 1 && walls.has(wallKey(cell, cell + 1)) ? " |" : "  ");
      below += (row < height - 1 && walls.has(wallKey(cell, cell + width)) ? "  --" : "    ") + "  ";
    }
    lines.push(line);
    if (row < height - 1) lines.push(below);
  }
  return lines.join("\n");
}
