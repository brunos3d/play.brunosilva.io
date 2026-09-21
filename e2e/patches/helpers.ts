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
