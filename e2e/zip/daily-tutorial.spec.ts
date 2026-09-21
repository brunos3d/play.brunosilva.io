import { expect, test } from "@playwright/test";
import { generateZipPuzzle, getZipDailyPuzzle } from "@/games/zip/engine";
import { result, skipTutorials, timer } from "../shared";
import { board, cellPoint, drawCells, openZip, visited } from "./helpers";

// 20:00 PDT on Monday 2026-09-21. In Tokyo it is already noon on the 22nd.
const FIXED_INSTANT = new Date("2026-09-22T03:00:00Z");

test.describe("daily", () => {
  test.use({ timezoneId: "Asia/Tokyo" });

  test("follows the Pacific date, records a streak, and shows the result again after a reload", async ({ page }) => {
    await skipTutorials(page);
    await page.clock.setFixedTime(FIXED_INSTANT);
    const { info, puzzle } = getZipDailyPuzzle(FIXED_INSTANT);
    expect(info.number).toBe(553);

    await openZip(page, "/zip");
    await expect(page.getByRole("heading", { name: "Zip" }).locator("..")).toContainText("#553");
    await drawCells(page, puzzle.width, puzzle.solution);

    await expect(result(page)).toBeVisible();
    await expect(result(page)).toContainText("Zip #553");
    await expect(page.getByTestId("game-streak")).toHaveText("1");
    await expect(page.getByTestId("game-next-countdown")).toContainText("Next puzzle in");

    await page.reload();
    await expect(result(page)).toBeVisible();
    await expect(board(page)).toHaveAttribute("data-solved", "true");
    await expect(visited(page)).toHaveCount(puzzle.solution.length);
  });
});

test("the first visit opens the interactive tutorial, the clock waits for it, and it can be completed", async ({ page }) => {
  await page.goto("/zip/play?seed=first-visit&difficulty=easy&size=5");
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await page.waitForTimeout(1_200);
  await expect(timer(page)).toHaveText("00:00");

  const lesson = generateZipPuzzle("tutorial-1", "easy", { size: 5 });
  const mini = tutorial.getByRole("grid");
  const drag = async (cells: number[]) => {
    const start = await cellPoint(mini, 5, cells[0]);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const cell of cells.slice(1)) {
      const point = await cellPoint(mini, 5, cell);
      await page.mouse.move(point.x, point.y, { steps: 3 });
    }
    await page.mouse.up();
  };

  await drag(lesson.solution.slice(0, 5));
  await expect(tutorial).toContainText("2. Numbers in order");
  await drag(lesson.solution.slice(4, 9));
  await expect(tutorial).toContainText("3. Take it back");
  const tap = await cellPoint(mini, 5, lesson.solution[5]);
  await page.mouse.click(tap.x, tap.y);
  await expect(tutorial).toContainText("4. Fill every cell");
  await drag(lesson.solution.slice(5));
  await expect(tutorial).toContainText("That is the whole game");
  await tutorial.getByRole("button", { name: "Start playing" }).click();
  await expect(tutorial).toBeHidden();

  // Now the board is in view, so the clock runs. The tutorial does not come back.
  await expect(timer(page)).not.toHaveText("00:00", { timeout: 5_000 });
  await page.reload();
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId("game-tutorial")).toBeHidden();
});
