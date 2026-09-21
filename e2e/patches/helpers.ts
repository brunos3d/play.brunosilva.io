import { type Locator, type Page, expect } from "@playwright/test";
import { type CellCoordinate, type Puzzle, type Rect, generateFromSpec, regionRect, resolveSpec } from "@/games/patches/engine";

/** A patch to draw: its rectangle and the clue cell the drag must start on. */
export type Target = { rect: Rect; clue: CellCoordinate };

export { skipTutorials as skipTutorial, status, watchConsole } from "../shared";

export function targetsOf(puzzle: Puzzle): Target[] {
  return puzzle.solution.map((region) => {
    const clue = puzzle.clues.find((entry) => entry.id === region.clueId)!;
    return { rect: regionRect(region), clue: { row: clue.row, column: clue.column } };
  });
}

export function practicePuzzle(seed: string, difficulty: string, size: number): { puzzle: Puzzle; targets: Target[]; url: string } {
  const puzzle = generateFromSpec(resolveSpec({ seed, difficulty, size }));
  return { puzzle, targets: targetsOf(puzzle), url: `/patches/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

export const board = (page: Page) => page.getByTestId("patches-board").first();
export const regions = (page: Page) => page.getByTestId("patches-region");

export async function openPuzzle(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
}

/** Centre of a cell, measured on the grid (the board has padding around it). */
export async function cellCenter(grid: Locator, size: number, cell: CellCoordinate) {
  const box = (await grid.boundingBox())!;
  const step = box.width / size;
  return { x: box.x + (cell.column + 0.5) * step, y: box.y + (cell.row + 0.5) * step };
}

const gridOf = (page: Page) => board(page).getByRole("grid");

/** Presses the first cell and visits the rest in order. The caller decides when to release. */
export async function dragThrough(page: Page, size: number, cells: readonly CellCoordinate[], grid: Locator = gridOf(page)): Promise<void> {
  const [first, ...rest] = cells;
  const start = await cellCenter(grid, size, first);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const cell of rest) {
    const point = await cellCenter(grid, size, cell);
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
}

/** The way a player draws: press the clue, sweep to one corner, then to the opposite one. */
export function sweep(target: Target): CellCoordinate[] {
  const { rect, clue } = target;
  return [clue, { row: rect.row, column: rect.column }, { row: rect.row + rect.height - 1, column: rect.column + rect.width - 1 }];
}

/**
 * A stroke that can never be right: the solution patch of a numbered clue, grown by one row or column that holds no
 * other clue. It has more cells than the clue allows. Strokes stop at other clues by themselves, so "swallow
 * everything" is no longer a way to draw something illegal.
 */
export function overshoot(puzzle: Puzzle): Target {
  for (const target of targetsOf(puzzle)) {
    const clue = puzzle.clues.find((entry) => entry.row === target.clue.row && entry.column === target.clue.column)!;
    if (clue.area === undefined) continue;
    const { row, column, width, height } = target.rect;
    const grown: Rect[] = [
      { row: row - 1, column, width, height: height + 1 },
      { row, column, width, height: height + 1 },
      { row, column: column - 1, width: width + 1, height },
      { row, column, width: width + 1, height },
    ];
    const fits = grown.find(
      (rect) =>
        rect.row >= 0 && rect.column >= 0 && rect.row + rect.height <= puzzle.height && rect.column + rect.width <= puzzle.width &&
        puzzle.clues.filter((entry) => entry.row >= rect.row && entry.row < rect.row + rect.height && entry.column >= rect.column && entry.column < rect.column + rect.width).length === 1,
    );
    if (fits) return { rect: fits, clue: target.clue };
  }
  throw new Error("no clue in this puzzle can be overshot");
}

/** The clue cell plus one neighbour inside its patch: a first stroke that leaves the patch unfinished. */
export function firstStroke(puzzle: Puzzle): { target: Target; part: Rect; area: number } {
  for (const target of targetsOf(puzzle)) {
    const clue = puzzle.clues.find((entry) => entry.row === target.clue.row && entry.column === target.clue.column)!;
    if (clue.area === undefined || clue.area < 4) continue;
    const { rect } = target;
    const sideways = rect.width > 1;
    const column = sideways ? Math.min(clue.column, rect.column + rect.width - 2) : clue.column;
    const row = sideways ? clue.row : Math.min(clue.row, rect.row + rect.height - 2);
    return { target, part: { row, column, width: sideways ? 2 : 1, height: sideways ? 1 : 2 }, area: clue.area };
  }
  throw new Error("no numbered clue of four or more cells in this puzzle");
}

export async function startDraw(page: Page, size: number, target: Target): Promise<void> {
  await dragThrough(page, size, sweep(target));
}

export async function draw(page: Page, size: number, target: Target): Promise<void> {
  await startDraw(page, size, target);
  await page.mouse.up();
}

export async function tapCell(page: Page, size: number, cell: CellCoordinate): Promise<void> {
  const point = await cellCenter(gridOf(page), size, cell);
  await page.mouse.click(point.x, point.y);
}

export async function solve(page: Page, size: number, targets: readonly Target[]): Promise<void> {
  for (const target of targets) await draw(page, size, target);
}
