import { type Locator, type Page, expect } from "@playwright/test";
import { type QueensPuzzle, generateQueensFromSpec, queensSeeds } from "@/games/queens/engine";

export function queensPuzzle(seed: string, difficulty: string, size: number): { puzzle: QueensPuzzle; url: string } {
  const puzzle = generateQueensFromSpec(queensSeeds.resolve({ seed, difficulty, size }));
  return { puzzle, url: `/queens/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

export const board = (page: Page) => page.getByTestId("queens-board").first();
export const queens = (page: Page) => board(page).locator('.queens-cell[data-mark="queen"]');
export const crosses = (page: Page) => board(page).locator('.queens-cell[data-mark="x"]');
export const ruledOut = (page: Page) => board(page).locator('.queens-cell[data-auto="true"]');

export async function openQueens(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
}

const gridOf = (page: Page) => board(page).getByRole("grid");

export async function cellPoint(grid: Locator, size: number, cell: number) {
  const box = (await grid.boundingBox())!;
  const step = box.width / size;
  return { x: box.x + ((cell % size) + 0.5) * step, y: box.y + (Math.floor(cell / size) + 0.5) * step };
}

export async function tapCell(page: Page, size: number, cell: number): Promise<void> {
  const point = await cellPoint(gridOf(page), size, cell);
  await page.mouse.click(point.x, point.y);
}

/** Two taps: an X, then a queen. */
export async function placeQueen(page: Page, size: number, cell: number): Promise<void> {
  await tapCell(page, size, cell);
  await tapCell(page, size, cell);
}

/** Presses the first cell and drags through the rest with the real mouse, then releases. */
export async function dragCells(page: Page, size: number, cells: readonly number[]): Promise<void> {
  const grid = gridOf(page);
  const start = await cellPoint(grid, size, cells[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const cell of cells.slice(1)) {
    const point = await cellPoint(grid, size, cell);
    await page.mouse.move(point.x, point.y, { steps: 3 });
  }
  await page.mouse.up();
}

export async function solve(page: Page, puzzle: QueensPuzzle): Promise<void> {
  for (const cell of puzzle.solution) await placeQueen(page, puzzle.size, cell);
}
