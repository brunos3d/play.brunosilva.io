import { type Locator, type Page, expect } from "@playwright/test";
import { type TermoLanguage, type TermoPuzzle, generateTermoFromSpec, isKnownWord, termoSeeds } from "@/games/termo/engine";
// The tests build puzzles in Node to know the hidden words. This import loads every language's list at once, which the app never does.
import "../../scripts/termo/all-words";

/** A puzzle and the address that opens it. Portuguese words unless `language` says otherwise, like a seed that names no language. */
export function termoPuzzle(seed: string, difficulty: string, language: TermoLanguage = "pt-br"): { puzzle: TermoPuzzle; url: string } {
  const puzzle = generateTermoFromSpec(termoSeeds.resolve({ seed, difficulty, lang: language }));
  return { puzzle, url: `/termo/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

const WRONG_WORDS: Record<TermoLanguage, readonly string[]> = {
  "pt-br": ["festa", "campo", "livro", "nuvem", "porta", "mundo", "sagaz", "vinho", "praia", "tigre", "dente", "bolsa"],
  en: ["plant", "house", "money", "river", "bread", "cloud", "stone", "light", "sugar", "world", "chair", "green"],
};

/** Known words of the puzzle's language that are none of its hidden words. Enough of them to lose any tier. */
export function wrongWords(puzzle: TermoPuzzle, count: number): string[] {
  const words = WRONG_WORDS[puzzle.language].filter((word) => isKnownWord(word, puzzle.language) && !puzzle.answers.includes(word)).slice(0, count);
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
