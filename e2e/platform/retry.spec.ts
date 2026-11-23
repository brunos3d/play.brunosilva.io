import { expect, test } from "@playwright/test";
import { result, skipTutorials, timer } from "../shared";
import { board as termoBoard, guess, keyboard, openTermo, row as termoRow, termoPuzzle, wrongWords } from "../termo/helpers";
import { board as zipBoard, drawCells, openZip, visited, zipPuzzle } from "../zip/helpers";

const SIZE = 5;
const zip = zipPuzzle("e2e-retry", "easy", SIZE);
const termo = termoPuzzle("e2e-retry", "medium");

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("a finished practice puzzle can be played again from the start, and the replay sets no best time", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openZip(page, zip.url);
  await page.clock.fastForward(9_000);
  await drawCells(page, SIZE, zip.puzzle.solution);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("New personal best");
  await result(page).getByRole("button", { name: "Close" }).click();

  // Under the board: the result, the same board again, or another board.
  const controls = page.locator(".mg-controls");
  await expect(controls.getByRole("button")).toHaveText(["View result", "Try again", "New game"]);
  await controls.getByRole("button", { name: "Try again" }).click();

  // The same board, empty, with the clock back at zero.
  await expect(zipBoard(page)).toHaveAttribute("data-solved", "false");
  await expect(zipBoard(page)).toHaveAttribute("data-locked", "false");
  await expect(visited(page)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(zip.puzzle.seed)));
  await expect(timer(page)).toHaveText("00:00");
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  // Solved faster the second time, with the answer known. It does not count as a best time.
  await page.clock.fastForward(2_000);
  await drawCells(page, SIZE, zip.puzzle.solution);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("A replay does not set a best time.");
  await expect(result(page)).not.toContainText("New personal best");

  // The result screen offers it too, and a reload keeps the board a replay.
  await result(page).getByTestId("game-result-retry").click();
  await expect(visited(page)).toHaveCount(0);
  await page.reload();
  await expect(zipBoard(page)).toHaveAttribute("data-locked", "false");
  await expect(visited(page)).toHaveCount(0);
});

test("a lost Termo practice game can be tried again with the same word", async ({ page }) => {
  await openTermo(page, termo.url);
  for (const word of wrongWords(termo.puzzle, 6)) await guess(page, word);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Out of guesses");
  await result(page).getByTestId("game-result-retry").click();

  await expect(termoBoard(page)).toHaveAttribute("data-locked", "false");
  await expect(keyboard(page)).toBeVisible();
  await expect(termoRow(page, 0)).toHaveAttribute("data-kind", "current");
  await guess(page, termo.puzzle.answers[0]);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).not.toContainText("Out of guesses");
});

test("a daily puzzle has no Try again", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await page.goto("/termo");
  await expect(termoBoard(page)).toHaveAttribute("data-locked", "false");
  await page.getByRole("button", { name: "Reveal" }).click();
  await page.getByTestId("game-confirm").getByRole("button", { name: "Reveal" }).click();
  await expect(result(page)).toBeVisible();
  await expect(result(page).getByTestId("game-result-retry")).toHaveCount(0);
  await result(page).getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("game-retry")).toHaveCount(0);
});
