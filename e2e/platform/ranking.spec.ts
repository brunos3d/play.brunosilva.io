import { expect, test } from "@playwright/test";
import { getZipDailyPuzzle } from "@/games/zip/engine";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { confirmReveal, result, skipTutorials } from "../shared";
import { board as zipBoard, drawCells, openZip } from "../zip/helpers";

/**
 * The ranking, against the real server and the test schema of the database.
 * Scores only count for today's puzzle, so these tests run on the real clock.
 * Without a database the feature is off and they skip themselves.
 */
test.beforeEach(async ({ page, request }) => {
  const session = await request.get("/api/session");
  test.skip(session.status() === 503, "the site runs without a database");
  await skipTutorials(page);
});

test("a solved daily puzzle earns points, and the player shows up in the rankings", async ({ page }) => {
  const { puzzle } = getZipDailyPuzzle(new Date());
  await openZip(page, "/zip");
  await drawCells(page, puzzle.width, puzzle.solution);
  await expect(result(page)).toBeVisible();

  // The points arrive a moment after the result, and lead to the game's ranking.
  const earned = result(page).getByTestId("game-result-points");
  await expect(earned).toContainText(/\+1[0-5]\d points in today's ranking/);
  await earned.click();
  await expect(page).toHaveURL(/\/en\/ranking\?game=zip$/);

  // One game on one day is ranked by time: everyone had the same puzzle.
  const mine = page.getByTestId("ranking-row").filter({ hasText: "you" });
  await expect(mine).toHaveCount(1);
  await expect(mine.getByTestId("ranking-score")).toHaveText(/^\d\d:\d\d$/);
  await expect(page.getByTestId("ranking-game-zip")).toHaveAttribute("aria-pressed", "true");

  // Everything else is ranked by points: the week, and all games together.
  await page.getByTestId("ranking-week").click();
  await expect(mine.getByTestId("ranking-score")).toHaveText(/^1[0-5]\d pts$/);
  await page.getByTestId("ranking-game-all").click();
  await expect(mine).toContainText("1 puzzle");
  // A game the player has not scored in today has no row for them.
  await page.getByTestId("ranking-today").click();
  await page.getByTestId("ranking-game-queens").click();
  await expect(page.getByTestId("ranking-row").filter({ hasText: "you" })).toHaveCount(0);

  // The player was created with a generated name, and can pick their own.
  const name = page.getByTestId("profile-name");
  await expect(name).toHaveValue(/^\w+ \d{3}$/);
  await name.fill("Bruno");
  await page.getByTestId("profile-avatar").click();
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-save")).toHaveText("Saved");
  await page.getByTestId("ranking-game-zip").click();
  await expect(page.getByTestId("ranking-row").filter({ hasText: "you" }).getByTestId("ranking-name")).toHaveText("Bruno");

  // The home screen shows the top of the week.
  await page.goto("/");
  await expect(page.getByTestId("hub-online")).toContainText("Bruno");
  await page.getByTestId("hub-ranking").click();
  await expect(page).toHaveURL(/\/en\/ranking$/);

  // Solving the same puzzle again cannot score twice: the first result of the day is the one that counts.
  const again = await page.request.post("/api/scores", { data: { game: "zip", date: pacificDateKey(new Date()), number: 1, difficulty: puzzle.difficulty, size: puzzle.width, elapsedMs: 2_000, hintsUsed: 0, mistakes: 0 } });
  expect(await again.json()).toMatchObject({ recorded: false });
});

test("a revealed daily puzzle earns nothing", async ({ page }) => {
  await openZip(page, "/zip");
  await confirmReveal(page);
  await expect(result(page)).toBeVisible();
  await expect(zipBoard(page)).toHaveAttribute("data-solved", "true");
  await page.waitForTimeout(1_500);
  await expect(result(page).getByTestId("game-result-points")).toHaveCount(0);
  await page.goto("/ranking?game=zip");
  await expect(page.getByTestId("ranking")).toBeVisible();
  await expect(page.getByTestId("ranking-row").filter({ hasText: "you" })).toHaveCount(0);
});

test("the server only takes scores that can be true", async ({ request }) => {
  const today = pacificDateKey(new Date());
  const score = { game: "zip", date: today, number: 1, difficulty: "medium", size: 6, elapsedMs: 60_000, hintsUsed: 0, mistakes: 0 };
  // Not today's puzzle: it is not an error, it just does not count.
  expect(await (await request.post("/api/scores", { data: { ...score, date: "2026-01-01" } })).json()).toMatchObject({ recorded: false });
  for (const broken of [{ game: "tetris" }, { elapsedMs: 10 }, { hintsUsed: -3 }, { difficulty: "brutal" }, { date: "tomorrow" }]) {
    expect((await request.post("/api/scores", { data: { ...score, ...broken } })).status(), JSON.stringify(broken)).toBe(400);
  }
  // A well-formed one counts once.
  expect(await (await request.post("/api/scores", { data: score })).json()).toEqual({ points: 150, recorded: true });
  expect(await (await request.post("/api/scores", { data: { ...score, elapsedMs: 5_000 } })).json()).toMatchObject({ recorded: false });
  // The cookie that says who the player is cannot be read by scripts on the page.
  const cookie = (await request.storageState()).cookies.find((entry) => entry.name === "play_player");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});

test("the ranking reads in Portuguese", async ({ page }) => {
  await page.goto("/pt-br/ranking");
  await expect(page.getByRole("heading", { name: "Ranking" })).toBeVisible();
  await expect(page.getByTestId("ranking-week")).toHaveText("Esta semana");
  await expect(page.getByTestId("ranking")).toContainText("100 pontos por resolver");
  await page.getByTestId("ranking-game-chess").click();
  await expect(page.getByTestId("ranking")).toContainText("As soluções mais rápidas do desafio de hoje");
});
