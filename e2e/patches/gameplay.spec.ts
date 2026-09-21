import { expect, test } from "@playwright/test";
import { confirmReveal, seconds, timer } from "../shared";
import { board, draw, openPuzzle, practicePuzzle, regions, skipTutorial, solve, startDraw, status, tapCell, watchConsole } from "./helpers";

const SIZE = 6;
const { puzzle, targets, url } = practicePuzzle("e2e-gameplay", "medium", SIZE);

test.beforeEach(async ({ page }) => {
  await skipTutorial(page);
});

test("drag places a patch, tap removes it, undo restores it, reset clears", async ({ page }) => {
  const problems = watchConsole(page);
  await openPuzzle(page, url);

  await draw(page, SIZE, targets[0]);
  await draw(page, SIZE, targets[1]);
  await expect(regions(page)).toHaveCount(2);
  await expect(status(page)).toContainText("Placed");

  await tapCell(page, SIZE, { row: targets[0].rect.row, column: targets[0].rect.column });
  await expect(regions(page)).toHaveCount(1);
  await expect(status(page)).toContainText("removed");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(regions(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(regions(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(problems).toEqual([]);
});

test("the preview reports valid and invalid, and an illegal release changes nothing", async ({ page }) => {
  await openPuzzle(page, url);
  const preview = page.getByTestId("patches-preview");

  await startDraw(page, SIZE, targets[0]);
  await expect(preview).toHaveAttribute("data-status", "valid");
  await page.mouse.up();
  await expect(regions(page)).toHaveCount(1);

  // Sweeping the whole board from a clue swallows every other clue, so it can never be one patch.
  const whole = { clue: targets[1].clue, rect: { row: 0, column: 0, width: SIZE, height: SIZE } };
  await startDraw(page, SIZE, whole);
  await expect(preview).toHaveAttribute("data-status", "invalid");
  await page.mouse.up();
  await expect(regions(page)).toHaveCount(1);
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(preview).toHaveCount(0);
});

test("a hint places the next provable patch itself, explains it, and is counted", async ({ page }) => {
  await openPuzzle(page, url);
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(regions(page)).toHaveCount(1);
  await expect(regions(page).first()).toHaveAttribute("data-tween", "true");
  await expect(status(page)).toHaveAttribute("data-kind", "hint");
  await expect(page.getByRole("button", { name: /^Hint/ })).toContainText("1");

  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(regions(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Hint/ })).toContainText("2");

  // A hinted patch is an ordinary patch: one undo takes it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(regions(page)).toHaveCount(1);
});

test("revealing solves the board piece by piece, hides the clues and earns nothing", async ({ page }) => {
  await openPuzzle(page, url);
  await draw(page, SIZE, targets[0]);
  await confirmReveal(page);

  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(regions(page)).toHaveCount(puzzle.clues.length, { timeout: 15_000 });
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  const shown = page.getByTestId("game-result");
  await expect(shown).toBeVisible();
  await expect(shown).toContainText("Solution revealed");
  await expect(shown).toContainText("does not count");
  await expect(shown.getByRole("button", { name: /Share/ })).toHaveCount(0);

  await shown.getByRole("button", { name: "Close" }).click();
  // A finished board is just the quilt: no numbers, no icons.
  await expect(page.locator(".patches-clue").first()).toHaveCSS("opacity", "0");
});

test("the clock starts when the board is first seen and keeps running while the player is away", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-21T18:00:00Z") });
  await openPuzzle(page, url);
  // Nothing has been touched yet, and the clock already runs.
  await page.clock.fastForward(3_000);
  await expect(timer(page)).toHaveText("00:03");

  await draw(page, SIZE, targets[0]);
  await draw(page, SIZE, targets[1]);

  // Ten minutes away from the game: tab closed, page reloaded. The clock does not care.
  await page.clock.fastForward("10:00");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(regions(page)).toHaveCount(2);
  expect(seconds(await timer(page).innerText())).toBeGreaterThanOrEqual(603);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(regions(page)).toHaveCount(1);
});

test("solving shows the result, locks the board and offers the next puzzle", async ({ page }) => {
  await openPuzzle(page, url);
  await solve(page, SIZE, targets);

  const result = page.getByTestId("game-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("Flawless");
  await expect(result).toContainText("New personal best");
  await expect(result.getByText("Moves").locator("..")).toContainText(String(puzzle.clues.length));
  await expect(board(page)).toHaveAttribute("data-solved", "true");

  await result.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/seed=PATCHES%3A[a-z0-9]{8}%3A1%3Amedium%3A6/);
  await expect(regions(page)).toHaveCount(0);
});

test("the keyboard alone can draw and remove a patch, starting from the clue", async ({ page }) => {
  await openPuzzle(page, url);
  const { rect, clue } = targets[0];
  const press = async (key: string, times: number) => {
    for (let i = 0; i < times; i++) await page.keyboard.press(key);
  };

  await page.getByRole("gridcell").first().focus();
  await press("ArrowDown", clue.row);
  await press("ArrowRight", clue.column);
  await page.keyboard.press("Enter");
  // Walk to the top-left corner, then to the bottom-right one. The patch keeps what it covered.
  await press("ArrowUp", clue.row - rect.row);
  await press("ArrowLeft", clue.column - rect.column);
  await press("ArrowDown", rect.height - 1);
  await press("ArrowRight", rect.width - 1);
  await expect(page.getByTestId("patches-preview")).toHaveAttribute("data-status", "valid");
  await page.keyboard.press("Enter");
  await expect(regions(page)).toHaveCount(1);

  await page.keyboard.press("Enter");
  await expect(regions(page)).toHaveCount(0);
  await page.keyboard.press("z");
  await expect(regions(page)).toHaveCount(1);
});

test("a shared URL rebuilds the same board", async ({ page, browser }) => {
  await openPuzzle(page, url);
  const labels = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  expect(labels.filter((label) => label?.includes("Clue:"))).toHaveLength(puzzle.clues.length);

  const other = await (await browser.newContext()).newPage();
  await skipTutorial(other);
  await openPuzzle(other, url);
  expect(await other.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(labels);
});

test("practice setup starts a seeded puzzle", async ({ page }) => {
  await page.goto("/patches/practice");
  await page.getByRole("button", { name: "hard" }).click();
  await page.getByRole("button", { name: "8 by 8" }).click();
  await page.getByTestId("game-seed-input").fill("my seed");
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/seed=PATCHES%3Amy-seed%3A1%3Ahard%3A8/);
  await expect(page.getByRole("gridcell")).toHaveCount(64);
});
