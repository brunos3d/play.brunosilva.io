import { expect, test } from "@playwright/test";
import { timer } from "../shared";
import { board, cellCenter, dragThrough, practicePuzzle } from "./helpers";

// No skipTutorial here: this file is about the first visit, with empty storage.
const { url } = practicePuzzle("e2e-tutorial", "easy", 5);

test("the first visit opens the interactive tutorial, and it can be completed", async ({ page }) => {
  await page.goto(url);

  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  // The clock waits while the tutorial covers the board.
  await page.waitForTimeout(1_200);
  await expect(timer(page)).toHaveText("00:00");
  const mini = tutorial.getByRole("grid");
  /** Each drag starts on the clue cell, the way the tutorial teaches it. */
  const drag = async (...cells: [number, number][]) => {
    await dragThrough(page, 4, cells.map(([row, column]) => ({ row, column })), mini);
    await page.mouse.up();
  };

  await drag([0, 0], [1, 1]);
  await expect(tutorial).toContainText("2. Shapes");
  // The 6 sits in the middle row of its 2x3 patch: up and left first, then down.
  await drag([1, 3], [0, 2], [2, 2]);
  await expect(tutorial).toContainText("3. Remove a patch");
  const tap = await cellCenter(mini, 4, { row: 0, column: 3 });
  await page.mouse.click(tap.x, tap.y);
  await expect(tutorial).toContainText("4. Undo");
  await tutorial.getByRole("button", { name: "Undo" }).click();
  await expect(tutorial).toContainText("5. No number");
  await drag([2, 0], [2, 1]);
  await drag([3, 2], [3, 0], [3, 3]);
  await expect(tutorial).toContainText("That is the whole game");
  await tutorial.getByRole("button", { name: "Start playing" }).click();
  await expect(tutorial).toBeHidden();

  await page.reload();
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId("game-tutorial")).toBeHidden();
});
