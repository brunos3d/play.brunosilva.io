import { expect, test } from "@playwright/test";
import { createWendGame, neighboursOf, wordStartedBy } from "@/games/wend/engine";
import { confirmReveal, result, seconds, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, cellPoint, count, dragPath, foundTrails, openWend, row, solveByDragging, tapCell, theme, tracing, trails, wendPuzzle } from "./helpers";

const { puzzle, url } = wendPuzzle("e2e-wend-1", "easy");
const SIZE = puzzle.size;
const [first, second] = puzzle.words;
/** The first two letters of the first word, backwards. It leads nowhere. */
const wrong = [first.path[1], first.path[0]];
/** A letter outside the first word that does not touch the second letter of the second word, so a tap on it starts a trail of its own. */
const lonely = puzzle.letters.findIndex((letter, cell) => letter !== "" && !first.path.includes(cell) && !second.path.slice(0, 2).includes(cell) && !neighboursOf(SIZE)[second.path[1]].includes(cell));

// The interface is English (a bare path is redirected to /en) and the words are Portuguese: `skipTutorials` pins the game language. languages.spec.ts covers the other combinations.
test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("the fixture's wrong trail really is wrong", () => {
  expect(wordStartedBy(puzzle, createWendGame(puzzle.id), wrong)).toBeNull();
  expect(first.text.length).toBeGreaterThanOrEqual(3);
  expect(lonely).toBeGreaterThanOrEqual(0);
});

test("tracing a word finds it, the list fills in, and the last word solves the board", async ({ page }) => {
  const problems = watchConsole(page);
  await openWend(page, url);
  await expect(status(page)).toHaveText(`Find ${puzzle.words.length} hidden words, of 4, 5, 6 and 7 letters. Each letter is used only once.`);
  await expect(theme(page)).toHaveText(`Theme: ${puzzle.theme}`);
  await expect(count(page)).toHaveText(`0 of ${puzzle.words.length}`);

  await dragPath(page, SIZE, first.path);
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(row(page, 0)).toHaveAttribute("data-found", "true");
  await expect(row(page, 0)).toHaveText(first.display);
  // A found word gets a check mark at the end of its row, and only that row has one.
  await expect(row(page, 0).getByTestId("wend-check")).toBeVisible();
  await expect(page.getByTestId("wend-check")).toHaveCount(1);
  // The rows are stacked, from the shortest word to the longest.
  const tops = await Promise.all(puzzle.words.map(async (_, index) => (await row(page, index).boundingBox())!.y));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(new Set(tops).size).toBe(puzzle.words.length);
  await expect(status(page)).toHaveText(`${first.display}! ${puzzle.words.length - 1} words to go.`);
  await expect(count(page)).toHaveText(`1 of ${puzzle.words.length}`);

  await solveByDragging(page, puzzle, [0]);
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Flawless");
  await expect(result(page).getByText("Erased")).toBeVisible();
  expect(problems).toEqual([]);
});

test("a trail that is not a word stays as a draft, and a tap on its first letter erases it", async ({ page }) => {
  await openWend(page, url);
  await dragPath(page, SIZE, wrong);
  await expect(trails(page)).toHaveCount(1);
  await expect(foundTrails(page)).toHaveCount(0);
  await expect(tracing(page)).toHaveText(`${puzzle.letters[wrong[0]]}${puzzle.letters[wrong[1]]}`);
  // Nothing says whether a draft is right or wrong.
  await expect(status(page)).not.toHaveAttribute("data-kind", "invalid");

  await tapCell(page, SIZE, wrong[0]);
  await expect(trails(page)).toHaveCount(0);
  await expect(status(page)).toContainText("Trail erased.");

  await solveByDragging(page, puzzle);
  await expect(result(page)).toBeVisible();
  // One erased trail of two letters.
  await expect(result(page).locator("dl .mg-stat").nth(1)).toContainText("1");
});

test("letters can be tapped one at a time, and a tap in the middle of a draft cuts it", async ({ page }) => {
  await openWend(page, url);
  for (const cell of first.path.slice(0, 3)) await tapCell(page, SIZE, cell);
  await expect(trails(page)).toHaveCount(1);
  await expect(tracing(page)).toHaveText(first.text.slice(0, 3));
  await tapCell(page, SIZE, first.path[1]);
  await expect(tracing(page)).toHaveText(first.text.slice(0, 2));
  for (const cell of first.path.slice(2)) await tapCell(page, SIZE, cell);
  await expect(foundTrails(page)).toHaveCount(1);
});

test("a hint erases a wrong draft and reveals letters one at a time, in the word list too", async ({ page }) => {
  await openWend(page, url);
  await dragPath(page, SIZE, wrong);
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText("Error fixed. First letter of a word revealed.");
  await expect(trails(page)).toHaveCount(1);
  await expect(row(page, 0)).toHaveText(first.display[0]);
  await expect(page.getByRole("button", { name: "Hint. 1 used." })).toBeVisible();

  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText("Next letter revealed.");
  await expect(row(page, 0)).toHaveText(first.display.slice(0, 2));
  for (let letter = 2; letter < first.text.length; letter++) await page.getByRole("button", { name: /Hint/ }).click();
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(status(page)).toContainText(`Last letter revealed: ${first.display}.`);
});

test("undo takes back one gesture, reset erases the drafts, and found words stay", async ({ page }) => {
  await openWend(page, url);
  await dragPath(page, SIZE, first.path);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await dragPath(page, SIZE, second.path.slice(0, 2));
  await tapCell(page, SIZE, lonely);
  await expect(trails(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(trails(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(trails(page)).toHaveCount(1);
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(status(page)).toContainText("Found words stay, and the clock keeps running.");
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
});

test("events that arrive faster than React renders still trace a word", async ({ page }) => {
  await openWend(page, url);
  const points = await Promise.all(first.path.map((cell) => cellPoint(page, SIZE, cell)));
  // Press, moves and release inside one task, with no render in between.
  await board(page).evaluate((element, path) => {
    const fire = (type: string, point: { x: number; y: number }) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, pointerId: 7, pointerType: "mouse", button: 0, clientX: point.x, clientY: point.y }));
    fire("pointerdown", path[0]);
    for (const point of path.slice(1)) fire("pointermove", point);
    fire("pointerup", path[path.length - 1]);
  }, points);
  await expect(foundTrails(page)).toHaveCount(1);
});

test("the keyboard plays the whole game", async ({ page }) => {
  await openWend(page, url);
  await board(page).getByRole("grid").focus();
  let cursor = puzzle.letters.findIndex((letter) => letter !== "");
  const moveTo = async (cell: number) => {
    const rows = Math.floor(cell / SIZE) - Math.floor(cursor / SIZE);
    const columns = (cell % SIZE) - (cursor % SIZE);
    for (let step = 0; step < Math.abs(rows); step++) await page.keyboard.press(rows > 0 ? "ArrowDown" : "ArrowUp");
    for (let step = 0; step < Math.abs(columns); step++) await page.keyboard.press(columns > 0 ? "ArrowRight" : "ArrowLeft");
    cursor = cell;
  };
  // Backspace takes one letter off.
  await moveTo(first.path[0]);
  await page.keyboard.press("Enter");
  await moveTo(first.path[1]);
  await page.keyboard.press("Enter");
  await expect(tracing(page)).toHaveText(first.text.slice(0, 2));
  await page.keyboard.press("Backspace");
  await expect(tracing(page)).toHaveText(first.text[0]);
  await page.keyboard.press("Backspace");
  await expect(trails(page)).toHaveCount(0);

  let found = 0;
  for (const word of puzzle.words) {
    for (const cell of word.path) {
      await moveTo(cell);
      await page.keyboard.press("Enter");
    }
    await expect(foundTrails(page)).toHaveCount(++found);
  }
  await expect(result(page)).toBeVisible();
});

test("reveal lays down every word and the result does not count", async ({ page }) => {
  await openWend(page, url);
  await dragPath(page, SIZE, wrong);
  await confirmReveal(page);
  await expect(result(page)).toBeVisible({ timeout: 15_000 });
  await expect(result(page)).toContainText("Solution revealed");
  await expect(foundTrails(page)).toHaveCount(puzzle.words.length);
  await expect(trails(page)).toHaveCount(puzzle.words.length);
});

test("progress survives a reload, with the clock still running", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openWend(page, url);
  await page.clock.fastForward(4_000);
  await expect(timer(page)).toHaveText("00:04");
  await dragPath(page, SIZE, first.path);
  await dragPath(page, SIZE, second.path.slice(0, 2));
  await expect(trails(page)).toHaveCount(2);

  await page.clock.fastForward("15:00");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(trails(page)).toHaveCount(2);
  await expect(foundTrails(page)).toHaveCount(1);
  expect(seconds((await timer(page).textContent())!)).toBeGreaterThanOrEqual(15 * 60);
  await solveByDragging(page, puzzle, [0]);
  await expect(result(page)).toBeVisible();
});

test("a harder board keeps its theme secret until the first word is found", async ({ page }) => {
  const hard = wendPuzzle("e2e-wend-hard", "hard");
  await openWend(page, hard.url);
  await expect(theme(page)).toHaveText("Theme: find a word to see it");
  await expect(theme(page)).not.toContainText(hard.puzzle.theme);
  await dragPath(page, hard.puzzle.size, hard.puzzle.words[0].path);
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(theme(page)).toContainText(hard.puzzle.theme);
});

test("the same seed builds the same board in another browser, and practice sizes go from 5 to 8", async ({ page, browser }) => {
  await openWend(page, url);
  const letters = async (target: typeof page) => target.getByTestId("wend-board").locator("[data-testid^='wend-cell-']").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-letter") ?? "#").join(""));
  const other = await (await browser.newContext()).newPage();
  await other.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: { wend: true } })));
  await other.goto(url);
  await expect(other.getByTestId("wend-board")).toBeVisible();
  expect(await letters(other)).toEqual(await letters(page));
  expect(await letters(page)).toBe(puzzle.letters.map((letter) => letter || "#").join(""));
  await other.context().close();

  await page.goto("/wend/practice");
  await expect(page.getByRole("button", { name: "5 by 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "8 by 8" })).toBeVisible();
  await expect(page.getByRole("button", { name: "4 by 4" })).toHaveCount(0);
  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/wend.svg");
});

test("the tutorial teaches on its own board, in the language of the puzzle under it, and can be skipped", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: {} })));
  await page.goto(url);
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByRole("heading", { name: "How to play Wend" })).toBeVisible();
  // English sentences about a Portuguese board: the seed is Portuguese, and the steps name the words they find on it.
  await expect(tutorial).toContainText("1. Connect the letters");
  await expect(tutorial).toContainText("The theme is fruit: start on the U and trace UVA along the top row.");
  await expect(tutorial.getByTestId("wend-theme")).toHaveText("Theme: Frutas");
  // The clock waits for the tutorial.
  await expect(timer(page)).toHaveText("00:00");

  // UVA along the top row of the tutorial board moves it to the second step.
  const grid = (await tutorial.getByRole("grid").boundingBox())!;
  const at = (cell: number) => ({ x: grid.x + ((cell % 3) + 0.5) * (grid.width / 3), y: grid.y + (Math.floor(cell / 3) + 0.5) * (grid.width / 3) });
  await page.mouse.move(at(0).x, at(0).y);
  await page.mouse.down();
  await page.mouse.move(at(1).x, at(1).y, { steps: 3 });
  await page.mouse.move(at(2).x, at(2).y, { steps: 3 });
  await page.mouse.up();
  await expect(tutorial).toContainText("2. Words turn corners");
  await expect(tutorial).toContainText("One fruit of 4 letters is left, and it starts on the F.");

  await tutorial.getByRole("button", { name: "Skip" }).click();
  await expect(tutorial).toBeHidden();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});
