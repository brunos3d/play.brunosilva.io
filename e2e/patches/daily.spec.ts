import { expect, test } from "@playwright/test";
import { getDailyPuzzle } from "@/games/patches/engine";
import { board, openPuzzle, regions, skipTutorial, solve, targetsOf, watchConsole } from "./helpers";

// 20:00 PDT on Monday 2026-09-21. In Tokyo it is already noon on the 22nd.
const FIXED_INSTANT = new Date("2026-09-22T03:00:00Z");

test.use({ timezoneId: "Asia/Tokyo" });

test.beforeEach(async ({ page }) => {
  await skipTutorial(page);
  await page.clock.setFixedTime(FIXED_INSTANT);
});

test("the daily puzzle follows the Pacific date, not the browser's timezone", async ({ page }) => {
  const problems = watchConsole(page);
  const { info, puzzle } = getDailyPuzzle(FIXED_INSTANT);
  expect(info.date).toBe("2026-09-21");
  expect(info.number).toBe(188);

  await openPuzzle(page, "/patches");
  await expect(page.getByRole("heading", { name: "Patches" }).locator("..")).toContainText("#188");
  await expect(page.getByRole("gridcell")).toHaveCount(puzzle.width * puzzle.height);
  expect(problems).toEqual([]);
});

test("finishing the daily records a streak, and the result comes back after a reload", async ({ page }) => {
  const { puzzle } = getDailyPuzzle(FIXED_INSTANT);
  await openPuzzle(page, "/patches");
  await solve(page, puzzle.width, targetsOf(puzzle));

  const result = page.getByTestId("game-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("Patches #188");
  await expect(result.getByRole("link", { name: /Play today's Zip/ })).toBeVisible();
  await expect(page.getByTestId("game-streak")).toHaveText("1");
  await expect(result).toContainText("Next puzzle in");
  const time = await page.getByTestId("game-result-time").innerText();

  await page.reload();
  await expect(page.getByTestId("game-result")).toBeVisible();
  await expect(page.getByTestId("game-result-time")).toHaveText(time);
  await expect(page.getByTestId("game-streak")).toHaveText("1");
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(regions(page)).toHaveCount(puzzle.clues.length);
});
