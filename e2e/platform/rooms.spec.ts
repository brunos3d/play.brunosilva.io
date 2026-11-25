import { type Browser, type Page, expect, test } from "@playwright/test";
import { generateZipFromSpec, zipSeeds } from "@/games/zip/engine";
import { skipTutorials } from "../shared";
import { board as zipBoard, drawCells } from "../zip/helpers";

/**
 * Challenge rooms, played by two real browsers against the real server and
 * the test schema of the database. Without a database the feature is off and
 * these tests skip themselves.
 */
test.beforeEach(async ({ request }) => {
  const session = await request.get("/api/session");
  test.skip(session.status() === 503, "the site runs without a database");
});

// Two players and several boards per test.
test.setTimeout(120_000);

async function player(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await skipTutorials(page);
  return page;
}

/** Solves the Zip board on screen. The puzzle is rebuilt from the seed in the address, as every player's browser does. */
async function solveZipRound(page: Page, round: number): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/zip/play\\?seed=.*&round=${round}$`));
  await expect(zipBoard(page)).toHaveAttribute("data-locked", "false");
  const spec = zipSeeds.parse(new URL(page.url()).searchParams.get("seed") ?? "");
  expect(spec).not.toBeNull();
  const puzzle = generateZipFromSpec(spec!);
  await drawCells(page, puzzle.width, puzzle.solution);
}

/** Opens a room of Zip rounds on small easy boards, and leaves the host in its lobby. Returns the invitation link. */
async function openRoom(host: Page, rounds: number): Promise<string> {
  await host.goto("/rooms/new?game=zip");
  const slider = host.getByTestId("room-rounds");
  await slider.focus();
  // The slider starts at three rounds.
  for (let presses = 3; presses > rounds; presses--) await host.keyboard.press("ArrowLeft");
  await expect(host.getByTestId("room-round-count")).toHaveText(rounds === 1 ? "1 round" : `${rounds} rounds`);
  await host.getByTestId("room-round-1").getByTestId("room-difficulty").selectOption("easy");
  await host.getByTestId("room-round-1").getByTestId("room-size").selectOption("5");
  if (rounds > 1) await host.getByTestId("room-same").click();
  await host.getByTestId("room-create").click();
  await expect(host).toHaveURL(/\/en\/rooms\/[A-Z2-9]{5}$/);
  await expect(host.getByTestId("room")).toHaveAttribute("data-status", "lobby");
  const link = await host.getByTestId("room-link").inputValue();
  expect(link).toMatch(/\/rooms\/[A-Z2-9]{5}$/);
  return link;
}

test("two players race through the same boards, and the table shows who won", async ({ browser }) => {
  const host = await player(browser);
  const guest = await player(browser);

  const link = await openRoom(host, 2);
  // The invitation has no locale. The guest's browser is sent to its own language, and sees who invites and what is played.
  await guest.goto(link);
  await expect(guest).toHaveURL(/\/en\/rooms\//);
  await expect(guest.getByTestId("room-join")).toContainText("invites you to a race");
  await expect(guest.getByTestId("room-round-list").getByRole("listitem")).toHaveCount(2);
  await guest.getByTestId("profile-name").fill("Ana");
  await guest.getByTestId("room-join-button").click();

  // Both lobbies list both players within a poll or two.
  await expect(guest.getByTestId("room-waiting")).toBeVisible();
  await expect(host.getByTestId("room-players").getByRole("listitem")).toHaveCount(2);
  await expect(host.getByTestId("room-players")).toContainText("Ana");
  // Only the host starts.
  await expect(guest.getByTestId("room-start")).toHaveCount(0);

  await host.getByTestId("room-start").click();
  // The start takes both players to the first board, with the same seed.
  await expect(host).toHaveURL(/\/zip\/play\?seed=.*&room=.*&round=1$/);
  await expect(guest).toHaveURL(/\/zip\/play\?seed=.*&room=.*&round=1$/);
  expect(new URL(guest.url()).searchParams.get("seed")).toBe(new URL(host.url()).searchParams.get("seed"));

  // A round of a race: the strip says where the player is, the clock runs, and there is no "New" or "Try again".
  await expect(host.getByTestId("race-round")).toHaveText("Round 1 of 2");
  await expect(host.getByTestId("race-clock")).toBeVisible();
  await expect(host.getByTestId("race-player")).toHaveCount(1);
  await expect(host.getByTestId("game-new")).toHaveCount(0);

  // The host solves both rounds. The next board follows by itself, and the last one leads to the table.
  await solveZipRound(host, 1);
  await solveZipRound(host, 2);
  await expect(host).toHaveURL(/\/en\/rooms\/[A-Z2-9]{5}$/);
  await expect(host.getByTestId("room-standing").first()).toHaveAttribute("data-state", "finished");
  await expect(host.getByTestId("room-standing").first()).toContainText("2 of 2 solved");

  // The guest is told, without anything covering the board, and may keep going.
  const toast = guest.getByTestId("race-toast");
  await expect(toast).toContainText("finished the race in");
  await expect(zipBoard(guest)).toBeVisible();
  await toast.getByRole("button", { name: "Keep going" }).click();
  await expect(toast).toHaveCount(0);

  // The guest solves one round, then gives up on the second.
  await solveZipRound(guest, 1);
  await expect(guest).toHaveURL(/round=2$/);
  await expect(guest.getByTestId("race-round")).toHaveText("Round 2 of 2");
  await guest.getByTestId("race-give-up").click();
  await guest.getByTestId("race-confirm").getByRole("button", { name: "Give up" }).click();
  await expect(guest).toHaveURL(/\/en\/rooms\/[A-Z2-9]{5}$/);

  // The race is over for everyone: the final table, the same on both screens.
  for (const page of [host, guest]) {
    await expect(page.getByTestId("room")).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("room-winner")).toBeVisible();
    const rows = page.getByTestId("room-standing");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute("data-state", "finished");
    await expect(rows.nth(1)).toHaveAttribute("data-state", "gave-up");
    await expect(rows.nth(1)).toContainText("Ana");
    await expect(rows.nth(1)).toContainText("gave up");
  }

  // The host opens another race with the same rounds, and the guest's table offers the way in.
  await host.getByTestId("room-rematch").click();
  await expect(host.getByTestId("room")).toHaveAttribute("data-status", "lobby");
  await guest.getByTestId("room-rematch-join").click();
  await expect(guest.getByTestId("room-join")).toBeVisible();
  // The guest already has a name: the invitation shows it.
  await expect(guest.getByTestId("profile-name")).toHaveValue("Ana");

  await host.context().close();
  await guest.context().close();
});

test("a race keeps its clock and its place through a reload, and a played round is not played twice", async ({ browser }) => {
  const host = await player(browser);
  await openRoom(host, 2);
  await host.getByTestId("room-start").click();
  await solveZipRound(host, 1);
  await expect(host).toHaveURL(/round=2$/);
  const second = host.url();

  // The clock is the server's. A reload does not reset it.
  await expect(host.getByTestId("race-clock")).toBeVisible();
  await host.reload();
  await expect(host.getByTestId("race-round")).toHaveText("Round 2 of 2");
  await expect(host.getByTestId("race-clock")).not.toHaveText("00:00");

  // Going back to the first round does not let it be played again: the player is sent on.
  await host.goBack();
  await expect(host).toHaveURL(second, { timeout: 15_000 });

  // The room's own page, in the middle of a race, offers the way back to the board.
  await host.goto(new URL(second).pathname.replace(/\/zip\/play$/, `/rooms/${new URL(second).searchParams.get("room")}`));
  await expect(host.getByTestId("room-go")).toContainText("Go to round 2");
  await host.getByTestId("room-go").click();
  await solveZipRound(host, 2);
  await expect(host.getByTestId("room")).toHaveAttribute("data-status", "finished");
  await host.context().close();
});

test("a hint costs time in a race, and a skipped round ranks below a solved one", async ({ browser }) => {
  const host = await player(browser);
  const guest = await player(browser);
  const link = await openRoom(host, 1);
  await guest.goto(link);
  await guest.getByTestId("room-join-button").click();
  await expect(host.getByTestId("room-players").getByRole("listitem")).toHaveCount(2);
  await host.getByTestId("room-start").click();
  await expect(guest).toHaveURL(/round=1$/);

  // The guest skips the round at once: the fastest way to the end, and still behind anyone who solves.
  await guest.getByRole("button", { name: "Reveal" }).click();
  await expect(guest.getByTestId("game-confirm")).toContainText("counts as not solved");
  await guest.getByTestId("game-confirm").getByRole("button", { name: "Skip the round" }).click();
  await expect(guest).toHaveURL(/\/en\/rooms\//, { timeout: 30_000 });

  // The host takes a hint, then solves.
  await expect(zipBoard(host)).toHaveAttribute("data-locked", "false");
  await host.getByRole("button", { name: /^Hint/ }).click();
  await expect(host.getByRole("button", { name: "Hint. 1 used." })).toBeVisible();
  // The hint draws its stretch cell by cell, and the board takes no input until it is done.
  await host.waitForTimeout(1_500);
  await solveZipRound(host, 1);
  await expect(host).toHaveURL(/\/en\/rooms\//, { timeout: 15_000 });

  const rows = host.getByTestId("room-standing");
  await expect(rows.nth(0)).toContainText("you");
  await expect(rows.nth(0)).toContainText("1 of 1 solved");
  await expect(rows.nth(0)).toContainText("includes 30 s for hints");
  await expect(rows.nth(1)).toContainText("0 of 1 solved");
  await host.context().close();
  await guest.context().close();
});

test("the room pages speak the visitor's language", async ({ browser }) => {
  const host = await player(browser);
  const link = await openRoom(host, 1);
  const context = await browser.newContext({ locale: "pt-BR" });
  const guest = await context.newPage();
  await skipTutorials(guest);
  await guest.goto(link);
  await expect(guest).toHaveURL(/\/pt-br\/rooms\//);
  await expect(guest.getByTestId("room-join")).toContainText("convida você para uma corrida");
  // A player created on a Portuguese page gets a Portuguese name to start with.
  await expect(guest.getByTestId("profile-name")).toHaveValue(/^(Raposa|Lontra|Coruja|Lince|Garça|Tucano|Falcão|Panda|Coala|Tigre|Lobo|Lebre|Foca|Arara|Capivara|Jabuti|Quati|Onça|Sagui|Sabiá) \d{3}$/);
  await guest.getByTestId("room-join-button").click();
  await expect(guest.getByTestId("room-waiting")).toContainText("começar");
  await host.context().close();
  await context.close();
});

test("a link to a room that does not exist says so and offers a new one", async ({ page }) => {
  await page.goto("/rooms/ZZZZZ");
  await expect(page.getByTestId("room-missing")).toContainText("This room does not exist");
  await page.getByRole("link", { name: "Open another room" }).click();
  await expect(page).toHaveURL(/\/en\/rooms\/new$/);
  await expect(page.getByTestId("room-setup")).toBeVisible();
});

test("the practice setup and the hub lead to the room setup, with the game picked", async ({ page }) => {
  await skipTutorials(page);
  await page.goto("/queens/practice");
  await page.getByTestId("game-challenge").click();
  await expect(page).toHaveURL(/\/en\/rooms\/new\?game=queens$/);
  await expect(page.getByTestId("room-round-1").getByTestId("room-game")).toHaveValue("queens");
  // A game without board sizes has no size picker, and Termo offers its modes.
  await page.getByTestId("room-round-2").getByTestId("room-game").selectOption("termo");
  await expect(page.getByTestId("room-round-2").getByTestId("room-size")).toHaveCount(0);
  await expect(page.getByTestId("room-round-2").getByTestId("room-difficulty").locator("option")).toHaveText(["Termo", "Dueto", "Quarteto"]);
  // A round made of words asks which language everyone will play in.
  await expect(page.getByTestId("game-language")).toBeVisible();

  await page.goto("/");
  await page.getByTestId("hub-challenge").click();
  await expect(page).toHaveURL(/\/en\/rooms\/new$/);
});
