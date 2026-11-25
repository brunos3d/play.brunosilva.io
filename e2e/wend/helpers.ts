import { type Page, expect } from "@playwright/test";
import { type WendPuzzle, generateWendFromSpec, wendSeeds } from "@/games/wend/engine";

export type WendLanguage = "en" | "pt-br";

/**
 * The puzzle a seed builds and the address that opens it. Portuguese unless a
 * language is given, as a seed without a language is. It stays synchronous:
 * the engine's index, imported above, has every word bank in memory, so a test
 * does not wait for one the way the browser does.
 */
export function wendPuzzle(seed: string, difficulty: string, size?: number, language?: WendLanguage): { puzzle: WendPuzzle; url: string } {
  const puzzle = generateWendFromSpec(wendSeeds.resolve({ seed, difficulty, size, lang: language }));
  return { puzzle, url: `/wend/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

/** The letters on the board, row by row, with # for a wall: the same string `lettersOf` gives for a puzzle. */
export const boardLetters = (page: Page, testId = "wend-board"): Promise<string> =>
  page
    .getByTestId(testId)
    .locator("[data-testid^='wend-cell-']")
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-letter") ?? "#").join(""));
export const lettersOf = (puzzle: { letters: readonly string[] }): string => puzzle.letters.map((letter) => letter || "#").join("");

export const board = (page: Page) => page.getByTestId("wend-board");
export const trails = (page: Page) => board(page).getByTestId("wend-trail");
export const foundTrails = (page: Page) => board(page).locator('[data-testid="wend-trail"][data-found]');
const stage = (page: Page) => page.locator(".mg-stage");
export const tracing = (page: Page) => stage(page).getByTestId("wend-tracing");
export const count = (page: Page) => stage(page).getByTestId("wend-count");
export const row = (page: Page, index: number) => stage(page).getByTestId(`wend-row-${index}`);
export const theme = (page: Page) => stage(page).getByTestId("wend-theme");

export async function openWend(page: Page, url: string): Promise<void> {
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

/** Presses on the first cell and drags through the rest with the real mouse. */
export async function dragPath(page: Page, size: number, cells: readonly number[]): Promise<void> {
  const start = await cellPoint(page, size, cells[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const cell of cells.slice(1)) {
    const point = await cellPoint(page, size, cell);
    await page.mouse.move(point.x, point.y, { steps: 3 });
  }
  await page.mouse.up();
}

/** Traces every hidden word that is still open, checking after each one that it was found. */
export async function solveByDragging(page: Page, puzzle: WendPuzzle, skip: readonly number[] = []): Promise<void> {
  let found = skip.length;
  for (const [index, word] of puzzle.words.entries()) {
    if (skip.includes(index)) continue;
    await dragPath(page, puzzle.size, word.path);
    await expect(foundTrails(page)).toHaveCount(++found);
  }
}
