import { type Locator, type Page, expect } from "@playwright/test";
import { type TermoPuzzle, generateTermoFromSpec, isKnownWord, termoSeeds } from "@/games/termo/engine";

export function termoPuzzle(seed: string, difficulty: string): { puzzle: TermoPuzzle; url: string } {
  const puzzle = generateTermoFromSpec(termoSeeds.resolve({ seed, difficulty }));
  return { puzzle, url: `/termo/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

/** Known words that are none of the puzzle's hidden words. Enough of them to lose any tier. */
export function wrongWords(puzzle: TermoPuzzle, count: number): string[] {
  const pool = ["festa", "campo", "livro", "nuvem", "porta", "mundo", "sagaz", "vinho", "praia", "tigre", "dente", "bolsa"];
  const words = pool.filter((word) => isKnownWord(word) && !puzzle.answers.includes(word)).slice(0, count);
  if (words.length < count) throw new Error("The fixture pool is too small for this puzzle.");
  return words;
}

export const board = (page: Page) => page.getByTestId("termo-board").first();
export const grid = (page: Page, index = 0) => board(page).locator(`[data-testid="termo-grid"][data-board="${index}"]`);
export const row = (page: Page, index: number, gridIndex = 0) => grid(page, gridIndex).locator(`[data-testid="termo-row"][data-row="${index}"]`);
export const tiles = (page: Page, rowIndex: number, gridIndex = 0) => row(page, rowIndex, gridIndex).getByTestId("termo-tile");
export const keyboard = (page: Page) => page.getByTestId("termo-keyboard");
export const key = (page: Page, name: string): Locator => keyboard(page).locator(`[data-key="${name}"]`);

export async function openTermo(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
}

/** Letters shown in a row, as one string. */
export async function rowText(page: Page, rowIndex: number, gridIndex = 0): Promise<string> {
  return (await tiles(page, rowIndex, gridIndex).allTextContents()).join("");
}

export async function rowMarks(page: Page, rowIndex: number, gridIndex = 0): Promise<(string | null)[]> {
  return tiles(page, rowIndex, gridIndex).evaluateAll((elements) => elements.map((element) => element.getAttribute("data-mark")));
}

/** Types a word on the physical keyboard and plays it. */
export async function guess(page: Page, word: string): Promise<void> {
  await page.keyboard.type(word);
  await page.keyboard.press("Enter");
}

/** Plays a word on the on-screen keyboard. */
export async function tapGuess(page: Page, word: string): Promise<void> {
  for (const letter of word) await key(page, letter).click();
  await key(page, "enter").click();
}
