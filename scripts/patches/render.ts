import { type Puzzle, type PuzzleShape, type Rect, type Region, regionRect } from "@/games/patches/engine";

const SHAPE_MARK = { square: "s", tall: "t", wide: "w", freeform: "*", unconstrained: " " } as const;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Clue grid. `6w` = 6 cells, wide. `?t` = unknown size, tall. `*` = dashed any-shape icon. */
export function renderClues(puzzle: PuzzleShape): string {
  const rows: string[] = [];
  for (let row = 0; row < puzzle.height; row++) {
    const cells: string[] = [];
    for (let column = 0; column < puzzle.width; column++) {
      const clue = puzzle.clues.find((entry) => entry.row === row && entry.column === column);
      if (!clue) cells.push(" . ");
      else cells.push(`${String(clue.area ?? "?").padStart(2)}${SHAPE_MARK[clue.shape ?? "unconstrained"]}`);
    }
    rows.push(cells.join(" "));
  }
  return rows.join("\n");
}

export function renderRects(width: number, height: number, rects: readonly Rect[]): string {
  const grid = Array.from({ length: height }, () => new Array<string>(width).fill("."));
  rects.forEach((rect, index) => {
    for (let row = rect.row; row < rect.row + rect.height; row++) {
      for (let column = rect.column; column < rect.column + rect.width; column++) grid[row][column] = LETTERS[index % LETTERS.length];
    }
  });
  return grid.map((row) => row.join(" ")).join("\n");
}

export function renderSolution(puzzle: Pick<Puzzle, "width" | "height"> & { solution: readonly Region[] }): string {
  return renderRects(puzzle.width, puzzle.height, puzzle.solution.map(regionRect));
}
