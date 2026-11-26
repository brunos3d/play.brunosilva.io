import { type Page, expect, test } from "@playwright/test";
import { getQueensDailyInfo } from "@/games/queens/engine/daily";
import { getZipDailyPuzzle } from "@/games/zip/engine";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { scorePoints } from "@/shared/online/scores";
import { confirmReveal, result, seconds, skipTutorials, timer } from "../shared";
import { board as zipBoard, drawCells, openZip } from "../zip/helpers";
import { createAccount, device, openProfile, score, signIn } from "./passkeys";

/**
 * A daily puzzle counts once per player, on whichever device they close it.
 * These tests play on two browsers signed in to one account, against the real
 * server and the test schema of the database, on the real clock: only today's
 * puzzle can be closed. Without a database they skip themselves.
 */
test.beforeEach(async ({ page, request }) => {
  const session = await request.get("/api/session");
  test.skip(session.status() === 503, "the site runs without a database");
  await skipTutorials(page);
});
test.setTimeout(90_000);

type Daily = { records: { game: string; variant: string; outcome: string; elapsedMs: number; hints: number; points: number; board: unknown }[]; opens: { game: string; openedAgoMs: number; hints: number }[] };
const dailyOf = async (page: Page): Promise<Daily> => (await (await page.request.get("/api/daily")).json()) as Daily;
const recordOf = async (page: Page, game: string) => (await dailyOf(page)).records.find((record) => record.game === game);

/** Solves today's Zip on the page, as a player would. */
async function solveZip(page: Page): Promise<void> {
  const { puzzle } = getZipDailyPuzzle(new Date());
  await openZip(page, "/zip");
  await drawCells(page, puzzle.width, puzzle.solution);
  await expect(result(page)).toBeVisible();
}

test("a daily solved on the phone is solved on the computer, board and all", async ({ page, browser }) => {
  await solveZip(page);
  await expect(result(page).getByTestId("game-result-points")).toBeVisible();
  const time = await result(page).getByTestId("game-result-time").innerText();
  // The solve created the player, so the server kept no board from that request. The device sent it again as soon as
  // the answer named the player.
  await expect.poll(async () => (await recordOf(page, "zip"))?.board).toBeTruthy();
  const credential = await createAccount(page);

  const computer = await device(browser);
  // Before signing in, the computer is a stranger: its hub offers the puzzle.
  await computer.goto("/");
  await expect(computer.getByTestId("hub-card-zip").getByRole("link", { name: /Play today/ })).toBeVisible();
  await signIn(computer, credential);

  // Back on the home screen, the day is closed, with the phone's time.
  await computer.goto("/");
  await expect(computer.getByTestId("hub-today-zip")).toContainText(`Solved in ${time}`);
  await expect(computer.getByTestId("hub-card-zip").getByRole("link", { name: /See result/ })).toBeVisible();
  await expect(computer.getByTestId("hub-card-zip").getByRole("link", { name: /Play today/ })).toHaveCount(0);
  // A game the player has not closed anywhere is still to be played.
  await expect(computer.getByTestId("hub-card-queens").getByRole("link", { name: /Play today/ })).toBeVisible();

  // The puzzle's own page opens the finished board the phone left, with its result and its points. There is nothing to play.
  await computer.getByTestId("hub-card-zip").getByRole("link", { name: /See result/ }).click();
  await expect(zipBoard(computer)).toHaveAttribute("data-solved", "true");
  await expect(zipBoard(computer)).toHaveAttribute("data-locked", "true");
  await expect(result(computer).getByTestId("game-result-time")).toHaveText(time);
  await expect(result(computer).getByTestId("game-result-points")).toBeVisible();
  await expect(computer.locator('[data-control="hint"]')).toHaveCount(0);

  // And the server would not take a second solve, whatever a device sent.
  const again = (await (await computer.request.post("/api/scores", { data: score("zip", 2_000) })).json()) as { recorded: boolean; points: number };
  expect(again).toMatchObject({ recorded: false, points: 0 });

  // Signing out takes the account's days off the computer: it is a stranger again.
  await openProfile(computer);
  await computer.getByTestId("account-sign-out").click();
  await expect(computer.getByTestId("profile")).toHaveAttribute("data-account", "false");
  await computer.goto("/");
  await expect(computer.getByTestId("hub-card-zip").getByRole("link", { name: /Play today/ })).toBeVisible();
  await computer.context().close();
});

test("a daily closed on a device that never sent its board is closed all the same", async ({ page, browser }) => {
  // The phone's close reaches the server without a board, as every close did before boards were kept.
  await page.request.post("/api/scores", { data: score("zip", 83_000, { hintsUsed: 1 }) });
  const credential = await createAccount(page);

  const computer = await device(browser);
  await signIn(computer, credential);
  await computer.goto("/");
  await expect(computer.getByTestId("hub-today-zip")).toContainText("Solved in 01:23");

  // There is no board to show, and none to play: the page says how the day went.
  await computer.goto("/zip");
  const closed = computer.getByTestId("daily-closed");
  await expect(closed).toHaveAttribute("data-outcome", "solved");
  await expect(closed).toContainText("You already solved today's puzzle");
  await expect(closed.getByTestId("daily-closed-time")).toHaveText("01:23");
  await expect(closed).toContainText("1 hint");
  await expect(zipBoard(computer)).toHaveCount(0);
  await expect(closed.getByRole("link", { name: "Play in Practice" })).toHaveAttribute("href", "/en/zip/practice");

  // In Portuguese too.
  await computer.goto("/pt-br/zip");
  await expect(computer.getByTestId("daily-closed")).toContainText("Você já resolveu o desafio de hoje");
  await computer.context().close();
});

test("a daily revealed on one device cannot be solved on another", async ({ page, browser }) => {
  // A player with an account: revealing only closes the day for someone the server knows.
  await page.request.post("/api/scores", { data: score("queens", 60_000) });
  const credential = await createAccount(page);

  // The reveal closes the day a moment after it is confirmed, while the solution is still drawing itself: that report
  // has no board yet. Leaving before the solution has played out changes nothing.
  await openZip(page, "/zip");
  const early = page.waitForRequest((sent) => sent.method() === "POST" && sent.url().endsWith("/api/scores"));
  await confirmReveal(page);
  const report = (await early).postDataJSON() as { revealed?: boolean; board?: unknown };
  expect(report.revealed).toBe(true);
  expect(report.board).toBeUndefined();
  await page.goto("/");
  await expect.poll(async () => (await recordOf(page, "zip"))?.outcome).toBe("revealed");

  const computer = await device(browser);
  await signIn(computer, credential);
  await computer.goto("/");
  await expect(computer.getByTestId("hub-today-zip")).toContainText("Solution revealed");
  await computer.goto("/zip");
  // Either the revealed board the phone sent, or the note that the day is closed: never a board to play.
  await expect(computer.locator('[data-testid="daily-closed"], [data-testid="zip-board"][data-locked="true"]').first()).toBeVisible();
  await expect(computer.locator('[data-control="hint"]')).toHaveCount(0);

  // A solve sent straight to the server earns nothing, and the ranking does not list the puzzle for the player.
  expect((await (await computer.request.post("/api/scores", { data: score("zip", 30_000) })).json()) as { recorded: boolean }).toMatchObject({ recorded: false });
  expect(await recordOf(computer, "zip")).toMatchObject({ outcome: "revealed", points: 0 });
  const me = ((await (await computer.request.get("/api/session")).json()) as { player: { id: string } }).player;
  const ranking = ((await (await computer.request.get("/api/ranking?period=today&game=zip")).json()) as { ranking: { entries: { id: string }[]; you: unknown } }).ranking;
  expect(ranking.entries.some((entry) => entry.id === me.id)).toBe(false);
  expect(ranking.you).toBeNull();
  await computer.context().close();
});

test("the clock of a daily opened on one device keeps running on the next", async ({ page, browser }) => {
  await page.request.post("/api/scores", { data: score("queens", 60_000) });
  const credential = await createAccount(page);
  // The phone opens the puzzle, takes a hint, and is put down.
  await openZip(page, "/zip");
  await page.locator('[data-control="hint"]').click();
  await expect.poll(async () => (await dailyOf(page)).opens.find((open) => open.game === "zip")?.hints).toBe(1);
  await page.waitForTimeout(6_000);

  const computer = await device(browser);
  await signIn(computer, credential);
  // The page waits for the server's word on the player's dailies before it builds the board.
  const synced = computer.waitForResponse((answer) => answer.url().endsWith("/api/daily") && answer.request().method() === "GET");
  await openZip(computer, "/zip");
  const state = (await (await synced).json()) as { opens: { game: string; openedAgoMs: number }[] };
  const since = state.opens.find((open) => open.game === "zip")?.openedAgoMs ?? 0;
  expect(since).toBeGreaterThanOrEqual(6_000);
  // The computer's board is fresh, and its clock is not: it starts where the phone's is, not at zero.
  expect(seconds(await timer(computer).innerText())).toBeGreaterThanOrEqual(Math.floor(since / 1000));

  // Whatever a device claims, the server counts the time since the first open and the hint the phone took.
  const answer = (await (await computer.request.post("/api/scores", { data: score("zip", 1_000) })).json()) as { recorded: boolean; record: { elapsedMs: number; hints: number; points: number } };
  expect(answer.recorded).toBe(true);
  expect(answer.record.elapsedMs).toBeGreaterThanOrEqual(4_000);
  expect(answer.record.hints).toBe(1);
  await computer.context().close();
});

test("a solve on a spare device player cannot launder a better time into the account", async ({ page, browser }) => {
  await page.request.post("/api/scores", { data: score("queens", 60_000) });
  const credential = await createAccount(page);
  // The account opens today's Zip and thinks, with two hints.
  const today = pacificDateKey(new Date());
  await page.request.post("/api/daily", { data: { game: "zip", date: today, hints: 2 } });
  await page.waitForTimeout(7_000);

  // A computer that is nobody yet enters the solution in two seconds, and only then signs in and brings its scores along.
  const computer = await device(browser);
  const fast = (await (await computer.request.post("/api/scores", { data: score("zip", 2_000) })).json()) as { recorded: boolean; record: { elapsedMs: number; hints: number; points: number } };
  expect(fast.record).toMatchObject({ elapsedMs: 2_000, hints: 0 });
  await signIn(computer, credential);
  await computer.getByTestId("account-merge-button").click();
  await expect(computer.getByTestId("account-notice")).toHaveAttribute("data-kind", "merged");

  // The close is the account's now, and so is the account's clock for that puzzle: seven seconds and two hints at least.
  const merged = await recordOf(computer, "zip");
  expect(merged?.outcome).toBe("solved");
  expect(merged?.elapsedMs).toBeGreaterThanOrEqual(7_000);
  expect(merged?.hints).toBe(2);
  expect(merged?.points).toBeLessThan(fast.record.points);
  await computer.context().close();
});

test("a board is kept only for a player the server already knew", async ({ playwright, baseURL }) => {
  const visitor = await playwright.request.newContext({ baseURL });
  const board = { snapshotVersion: 1, puzzleId: "zip-x", path: [0, 1, 2], startedAt: 1, finishedMs: 60_000 };
  // The request that creates the player cannot also store a board's worth of anything.
  const first = (await (await visitor.post("/api/scores", { data: score("zip", 60_000, { board }) })).json()) as { recorded: boolean; record: { board: unknown } };
  expect(first).toMatchObject({ recorded: true, record: { board: null } });
  // The device sends it again with its next sync, and now it is somebody's.
  const second = (await (await visitor.post("/api/scores", { data: score("zip", 60_000, { board }) })).json()) as { recorded: boolean; record: { board: unknown } };
  expect(second.recorded).toBe(false);
  expect(second.record.board).toEqual(board);
  // A board never changes how the daily ended, or replaces one that is there.
  const third = (await (await visitor.post("/api/scores", { data: score("zip", 5_000, { board: { ...board, finishedMs: 5_000 } }) })).json()) as { record: { board: unknown; elapsedMs: number } };
  expect(third.record).toMatchObject({ board, elapsedMs: 60_000 });
  await visitor.dispose();
});

test("the server decides what a daily is worth", async ({ request }) => {
  const today = pacificDateKey(new Date());
  // A language that is not one: there is one Zip a day, and no way to make it two.
  expect((await request.post("/api/scores", { data: score("zip", 60_000, { variant: "xx" }) })).status()).toBe(400);
  expect((await request.post("/api/scores", { data: score("zip", 60_000, { variant: "en" }) })).status()).toBe(400);
  expect((await request.post("/api/scores", { data: score("termo", 60_000, { variant: "fr" }) })).status()).toBe(400);
  // Termo and Wend have a daily per game language, and that is all.
  expect((await (await request.post("/api/scores", { data: score("termo", 60_000, { variant: "en" }) })).json()) as { recorded: boolean }).toMatchObject({ recorded: true });

  // The difficulty and the number come from the game's schedule. A claim of another difficulty changes nothing: the
  // points are the schedule's, for a time slow enough that every difficulty pays differently.
  const slow = 20 * 60_000;
  const info = getQueensDailyInfo(today);
  const claimed = info.difficulty === "expert" ? "easy" : "expert";
  const honest = (await (await request.post("/api/scores", { data: score("queens", slow, { difficulty: claimed, number: 99_999 }) })).json()) as { points: number; record: { difficulty: string; number: number; date: string } };
  expect(honest.record).toMatchObject({ date: today, difficulty: info.difficulty, number: info.number });
  expect(honest.points).toBe(scorePoints(info.difficulty, slow, 0));
  expect(honest.points).not.toBe(scorePoints(claimed, slow, 0));
});

test("a reveal by a visitor without a player is not stored, and writes from another site are refused", async ({ playwright, baseURL }) => {
  const visitor = await playwright.request.newContext({ baseURL });
  const answer = await visitor.post("/api/scores", { data: score("zip", 5_000, { revealed: true }) });
  expect(await answer.json()).toEqual({ points: 0, recorded: false, record: null, player: null });
  expect((await visitor.storageState()).cookies.some((cookie) => cookie.name === "play_player")).toBe(false);
  // Opening a daily does not create one either.
  expect(await (await visitor.post("/api/daily", { data: { game: "zip", date: pacificDateKey(new Date()), hints: 0 } })).json()).toEqual({ openedAgoMs: null });
  expect((await visitor.storageState()).cookies.some((cookie) => cookie.name === "play_player")).toBe(false);

  // A page of another site cannot make this one hand out a new player's cookie.
  const forgeries: Record<string, string>[] = [{ "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }, { origin: "https://evil.example" }];
  for (const headers of forgeries) {
    const forged = await visitor.post("/api/session", { data: { name: "Mallory" }, headers });
    expect(forged.status(), JSON.stringify(headers)).toBe(403);
  }
  expect((await visitor.storageState()).cookies.some((cookie) => cookie.name === "play_player")).toBe(false);
  // The site's own pages still can.
  expect((await visitor.post("/api/session", { data: { name: "Ana" }, headers: { "sec-fetch-site": "same-origin" } })).status()).toBe(200);
  await visitor.dispose();
});

test("the seed of today's daily opens the daily, not a practice copy of it", async ({ page }) => {
  const { puzzle } = getZipDailyPuzzle(new Date());
  await page.goto(`/zip/play?seed=${encodeURIComponent(puzzle.seed)}`);
  await expect(page).toHaveURL(/\/en\/zip$/);
  await expect(zipBoard(page)).toBeVisible();
  // The daily has no "New" control: this is the day's one board.
  await expect(page.getByTestId("game-new")).toHaveCount(0);
});
