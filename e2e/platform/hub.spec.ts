import { expect, test } from "@playwright/test";
import { getZipDailyPuzzle } from "@/games/zip/engine";
import { skipTutorials, watchConsole } from "../shared";
import { drawCells, openZip } from "../zip/helpers";

const FIXED_INSTANT = new Date("2026-09-21T18:00:00Z");

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("the hub lists every game with today's number and a countdown to the next boards", async ({ page }) => {
  const problems = watchConsole(page);
  await page.clock.setFixedTime(FIXED_INSTANT);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Minigames" })).toBeVisible();
  await expect(page.getByTestId("hub-today-zip")).toContainText("#553");
  await expect(page.getByTestId("hub-today-patches")).toContainText("#188");
  await expect(page.getByTestId("hub-today-zip")).toContainText("Not played yet");
  // 18:00 UTC is 11:00 PDT: thirteen hours to midnight Pacific.
  await expect(page.getByTestId("hub-countdown")).toContainText("13:00:00");
  expect(problems).toEqual([]);
});

test("the hub follows a daily puzzle from running clock to solved, with the streak", async ({ page }) => {
  await page.clock.install({ time: FIXED_INSTANT });
  const { puzzle } = getZipDailyPuzzle(FIXED_INSTANT);

  await page.goto("/");
  await page.getByTestId("hub-card-zip").getByRole("link", { name: /Play today's puzzle/ }).click();
  await expect(page).toHaveURL(/\/zip$/);
  await openZip(page, "/zip");
  await drawCells(page, puzzle.width, puzzle.solution.slice(0, 5));

  // Leaving does not stop the clock. The hub says so.
  await page.clock.fastForward("02:00");
  await page.goto("/");
  await expect(page.getByTestId("hub-today-zip")).toContainText("Clock running");
  await expect(page.getByTestId("hub-today-zip")).toContainText(/02:\d\d/);
  await expect(page.getByTestId("hub-card-zip").getByRole("link", { name: /Continue playing/ })).toBeVisible();

  await openZip(page, "/zip");
  await drawCells(page, puzzle.width, puzzle.solution.slice(4));
  await expect(page.getByTestId("game-result")).toBeVisible();
  // The result suggests the next two games still open today, and the hub for the rest.
  await expect(page.getByTestId("game-result-suggestion")).toHaveCount(2);
  await expect(page.getByTestId("game-result").getByRole("link", { name: "See the other games" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByTestId("hub-today-zip")).toContainText("Solved in");
  await expect(page.getByTestId("hub-card-zip").getByLabel("1 day streak")).toBeVisible();
  await expect(page.getByTestId("hub-card-zip").getByRole("link", { name: /See today's result/ })).toBeVisible();
  // The other game is untouched.
  await expect(page.getByTestId("hub-today-patches")).toContainText("Not played yet");
});

test("players can move between games and back to the hub from anywhere", async ({ page }) => {
  await page.goto("/zip");
  await page.getByRole("link", { name: "Play Patches" }).click();
  await expect(page).toHaveURL(/\/patches$/);
  await expect(page.getByRole("heading", { name: "Patches" })).toBeVisible();
  await page.getByRole("link", { name: "All games" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("hub-card-patches").getByRole("link", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/patches\/practice$/);
  await page.getByRole("link", { name: "Daily" }).click();
  await expect(page).toHaveURL(/\/patches$/);
});

test("every game is on the hub from its launch day, numbered from 1", async ({ page }) => {
  // 2026-11-23 18:00 UTC is a Monday morning in Pacific time, the day after Chess and Queens launched.
  await page.clock.setFixedTime(new Date("2026-11-23T18:00:00Z"));
  await page.goto("/");
  for (const game of ["zip", "patches", "chess", "queens", "sumbreak", "wend", "termo"]) await expect(page.getByTestId(`hub-card-${game}`)).toBeVisible();
  await expect(page.getByTestId("hub-today-chess")).toContainText("#2");
  await expect(page.getByTestId("hub-today-chess")).toContainText("easy");
  await expect(page.getByTestId("hub-today-queens")).toContainText("#2");
  // Wend counts from the day LinkedIn's Wend launched, and Termo from its own first day here.
  await expect(page.getByTestId("hub-today-wend")).toContainText("#168");
  await expect(page.getByTestId("hub-today-termo")).toContainText("#2");
  await page.getByTestId("hub-card-chess").getByRole("link", { name: /Play today's puzzle/ }).click();
  await expect(page).toHaveURL(/\/chess$/);
  await expect(page.getByTestId("chess-board")).toBeVisible();
});

test("the game's mark in the header leads home, and asks first once a puzzle is under way", async ({ page }) => {
  const { puzzle } = getZipDailyPuzzle(new Date());
  await openZip(page, "/zip");

  // Nothing played yet: the mark is a plain link.
  await page.getByTestId("game-home").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Minigames" })).toBeVisible();

  await openZip(page, "/zip");
  await drawCells(page, puzzle.width, puzzle.solution.slice(0, 4));
  await page.getByTestId("game-home").click();
  const leave = page.getByTestId("game-leave");
  await expect(leave).toBeVisible();
  await expect(leave).toContainText("the clock keeps running");
  await leave.getByRole("button", { name: "Keep playing" }).click();
  await expect(leave).toBeHidden();
  await expect(page).toHaveURL(/\/zip$/);

  // The grid icon on the right asks the same question, and "Leave" goes home with the board saved.
  await page.getByRole("link", { name: "All games", exact: true }).first().click();
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Leave" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("hub-card-zip").getByRole("link", { name: /Continue playing/ })).toBeVisible();

  // A solved board has nothing left to lose, so it leaves at once.
  await openZip(page, "/zip");
  await drawCells(page, puzzle.width, puzzle.solution.slice(3));
  await expect(page.getByTestId("game-result")).toBeVisible();
  await page.getByTestId("game-result").getByRole("button", { name: "Close" }).click();
  await page.getByTestId("game-home").click();
  await expect(page).toHaveURL(/\/$/);
});

test("each game has its own practice setup, sizes and icon", async ({ page }) => {
  await page.goto("/zip/practice");
  await expect(page.getByRole("button", { name: "8 by 8" })).toBeVisible();
  await expect(page.getByRole("button", { name: "9 by 9" })).toHaveCount(0);
  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/zip.svg");
  await page.getByRole("button", { name: "expert" }).click();
  await page.getByTestId("game-seed-input").fill("my seed");
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/seed=ZIP%3Amy-seed%3A2%3Aexpert/);
  // With automatic size, expert draws 7x7 or 8x8 from the seed.
  await expect(page.getByTestId("zip-board")).toHaveAttribute("data-locked", "false");
  expect([49, 64]).toContain(await page.getByRole("gridcell").count());

  await page.goto("/patches/practice");
  await expect(page.getByRole("button", { name: "10 by 10" })).toBeVisible();
  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/patches.svg");
});

test("an old Zip link lands on the new practice route", async ({ page }) => {
  await page.goto("/hard/42");
  await expect(page).toHaveURL(/\/zip\/play\?seed=42&difficulty=hard$/);
  await expect(page.getByTestId("zip-board")).toBeVisible();
  await page.goto("/nonsense/42");
  await expect(page).toHaveURL(/\/$/);
});

test("sound is on by default and the setting is shared by both games", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("minigames:settings:v1"));
  await page.goto("/zip/play?seed=settings&difficulty=easy&size=5");
  await page.getByTestId("game-tutorial").getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const sound = page.getByTestId("game-settings").getByRole("switch", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-checked", "true");
});
