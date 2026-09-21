import { type Locator, type Page, expect } from "@playwright/test";
import { type ZipPuzzle, buildTopology, generateZipFromSpec, zipSeeds } from "@/games/zip/engine";

export function zipPuzzle(seed: string, difficulty: string, size: number): { puzzle: ZipPuzzle; url: string } {
  const puzzle = generateZipFromSpec(zipSeeds.resolve({ seed, difficulty, size }));
  return { puzzle, url: `/zip/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

export const board = (page: Page) => page.getByTestId("zip-board").first();
export const visited = (page: Page) => board(page).locator('.zip-cell[data-visited="true"]');

export async function openZip(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
}

export async function cellPoint(grid: Locator, size: number, cell: number) {
  const box = (await grid.boundingBox())!;
  const step = box.width / size;
  return { x: box.x + ((cell % size) + 0.5) * step, y: box.y + (Math.floor(cell / size) + 0.5) * step };
}

const gridOf = (page: Page) => board(page).getByRole("grid");

/** Presses the first cell and drags through the rest with the real mouse. The caller releases. */
export async function dragCells(page: Page, size: number, cells: readonly number[], grid: Locator = gridOf(page)): Promise<void> {
  const start = await cellPoint(grid, size, cells[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const cell of cells.slice(1)) {
    const point = await cellPoint(grid, size, cell);
    await page.mouse.move(point.x, point.y, { steps: 3 });
  }
}

export async function drawCells(page: Page, size: number, cells: readonly number[]): Promise<void> {
  await dragCells(page, size, cells);
  await page.mouse.up();
}

export async function tapCell(page: Page, size: number, cell: number): Promise<void> {
  const point = await cellPoint(gridOf(page), size, cell);
  await page.mouse.click(point.x, point.y);
}

/** A cell next to the path's head that the rules refuse, with the reason. */
export function refusedNeighbor(puzzle: ZipPuzzle, prefixLength: number): { cell: number; reason: RegExp } | null {
  const topology = buildTopology(puzzle);
  const path = puzzle.solution.slice(0, prefixLength);
  const head = path[path.length - 1];
  const { width, height } = puzzle;
  const around = [head - width, head + 1, head + width, head - 1].filter((cell, index) => {
    if (cell < 0 || cell >= width * height) return false;
    return index % 2 === 0 || Math.floor(cell / width) === Math.floor(head / width);
  });
  for (const cell of around) {
    if (path.includes(cell)) continue;
    if (!topology.neighbors[head].includes(cell)) return { cell, reason: /wall/i };
  }
  return null;
}
