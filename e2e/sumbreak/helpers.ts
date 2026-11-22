import { type Page, expect } from "@playwright/test";
import { type Merge, type SumbreakPuzzle, generateSumbreakFromSpec, sumbreakSeeds } from "@/games/sumbreak/engine";

export function sumbreakPuzzle(seed: string, difficulty: string, size: number): { puzzle: SumbreakPuzzle; url: string } {
  const puzzle = generateSumbreakFromSpec(sumbreakSeeds.resolve({ seed, difficulty, size }));
  return { puzzle, url: `/sumbreak/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

export const board = (page: Page) => page.getByTestId("sumbreak-board").first();
export const tiles = (page: Page) => board(page).getByTestId("sumbreak-tile");
export const tileAt = (page: Page, cell: number) => board(page).locator(`[data-testid="sumbreak-tile"][data-cell="${cell}"]`);

export async function openSumbreak(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
}

export async function cellPoint(page: Page, size: number, cell: number) {
  const box = (await board(page).getByRole("grid").boundingBox())!;
  const step = box.width / size;
  return { x: box.x + ((cell % size) + 0.5) * step, y: box.y + (Math.floor(cell / size) + 0.5) * step };
}

export async function tapCell(page: Page, size: number, cell: number): Promise<void> {
  const point = await cellPoint(page, size, cell);
  await page.mouse.click(point.x, point.y);
}

/** Drags the tile on `from` onto `to` with the real mouse. */
export async function dragMerge(page: Page, size: number, merge: Merge): Promise<void> {
  const from = await cellPoint(page, size, merge.from);
  const to = await cellPoint(page, size, merge.to);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
}

/** Two taps: the tile to move, then the tile to drop it on. */
export async function tapMerge(page: Page, size: number, merge: Merge): Promise<void> {
  await tapCell(page, size, merge.from);
  await tapCell(page, size, merge.to);
}

/** Plays merges by dragging, checking after each one that a tile went away. */
export async function playMerges(page: Page, puzzle: SumbreakPuzzle, merges: readonly Merge[], startCount = puzzle.size * puzzle.size): Promise<void> {
  let count = startCount;
  for (const merge of merges) {
    await dragMerge(page, puzzle.size, merge);
    await expect(tiles(page)).toHaveCount(--count);
  }
}
