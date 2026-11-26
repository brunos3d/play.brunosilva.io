import { type Browser, type BrowserContext, type Page, expect, test } from "@playwright/test";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { PHONE_HEIGHT, phoneProblems } from "../layout";
import { SETTINGS_KEY, inLocale, skipTutorials } from "../shared";

/**
 * Every screen of the site, at the widths of real phones and in both
 * languages. Portuguese labels run longer than English ones, so a row of
 * buttons that fits in English can break in Portuguese. `phoneProblems` says
 * what does not fit: see e2e/layout.ts for what it looks at.
 *
 * The tests set their own viewport, so they run once, in the mobile project.
 */
const LOCALES = ["en", "pt-br"] as const;
type Locale = (typeof LOCALES)[number];
const GAMES = ["zip", "patches", "chess", "queens", "sumbreak", "wend", "termo"] as const;

test.use({ viewport: { width: 360, height: PHONE_HEIGHT } });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "these tests set phone widths themselves");
});
test.setTimeout(120_000);

/**
 * Checks the screen as it is, and names it in the failure. The check is soft,
 * so one run lists every screen that does not fit.
 *
 * `LAYOUT_SHOTS=some/folder` also saves a picture of every screen at every
 * width, for looking at what the checks cannot judge: spacing and balance.
 */
async function expectToFit(page: Page, screen: string): Promise<void> {
  const folder = process.env.LAYOUT_SHOTS;
  const name = `${test.info().titlePath.slice(-2).join(" ")} ${screen}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const shot = folder ? async (width: number) => void (await page.screenshot({ path: `${folder}/${name}-${width}.png`, fullPage: true })) : undefined;
  expect.soft(await phoneProblems(page, shot), screen).toEqual([]);
}

const dialog = (page: Page) => page.locator("dialog[open]");

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
}

/** A game page that is ready to be played: the board is there and the controls answer. */
async function openGame(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('[data-control="hint"]')).toBeEnabled({ timeout: 30_000 });
}

async function hasDatabase(page: Page): Promise<boolean> {
  return (await page.request.get("/api/session")).status() !== 503;
}

for (const locale of LOCALES) {
  test.describe(`phone layout, ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await skipTutorials(page, { gameLanguage: locale });
    });

    test("the hub, its settings and its language menu", async ({ page }) => {
      await page.goto(inLocale(locale, "/"));
      await expect(page.getByTestId("hub-countdown")).not.toContainText("--");
      await expect(page.getByTestId("hub-today-termo")).toContainText("#");
      await expectToFit(page, "hub");

      await page.locator(".mg-header-actions > button").last().click();
      await expect(page.getByTestId("game-settings")).toBeVisible();
      await expectToFit(page, "hub settings");
      await closeDialog(page);

      await page.getByTestId("locale-switcher").locator("button").first().click();
      await expect(page.locator(".mg-menu")).toBeVisible();
      await expectToFit(page, "language menu");
    });

    test("the hub after a day of play", async ({ page }) => {
      // One game given up on, one left running: the two longest lines a card can show.
      await openGame(page, inLocale(locale, "/zip"));
      await page.locator('[data-control="reveal"]').click();
      await page.getByTestId("game-confirm").locator('.mg-button[data-variant="primary"]').click();
      await expect(page.getByTestId("game-result")).toBeVisible();
      await openGame(page, inLocale(locale, "/patches"));
      await expect(page.getByTestId("game-timer")).not.toHaveText("00:00");

      await page.goto(inLocale(locale, "/"));
      await expect(page.getByTestId("hub-today-patches").locator("svg")).toBeVisible();
      await expect(page.getByTestId("hub-today-zip").locator("svg")).toBeVisible();
      await expectToFit(page, "hub after playing");
    });

    for (const game of GAMES) {
      test(`${game}: the daily puzzle and its dialogs`, async ({ page }) => {
        await openGame(page, inLocale(locale, `/${game}`));
        await expectToFit(page, "daily puzzle");

        await page.locator(".mg-header-actions > button").first().click();
        await expect(dialog(page)).toBeVisible();
        await expectToFit(page, "how to play");
        await closeDialog(page);

        await page.locator(".mg-header-actions > button").last().click();
        await expect(page.getByTestId("game-settings")).toBeVisible();
        await expectToFit(page, "settings");
        await closeDialog(page);

        await page.locator('[data-control="hint"]').click();
        await expectToFit(page, "after a hint");

        await page.locator('[data-control="reveal"]').click();
        await expect(page.getByTestId("game-confirm")).toBeVisible();
        await expectToFit(page, "reveal confirmation");
        await page.getByTestId("game-confirm").locator('.mg-button[data-variant="primary"]').click();
        await expect(page.getByTestId("game-result")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("game-result-all")).toBeVisible();
        await expectToFit(page, "result");
        await closeDialog(page);
        await expectToFit(page, "finished puzzle");
      });

      test(`${game}: practice, from the setup to the board`, async ({ page }) => {
        await page.goto(inLocale(locale, `/${game}/practice`));
        await expect(page.getByTestId("game-start")).toBeVisible();
        await expectToFit(page, "practice setup");

        await page.getByTestId("game-start").click();
        await expect(page.locator('[data-control="hint"]')).toBeEnabled({ timeout: 30_000 });
        await page.locator('[data-control="hint"]').click();
        // Five controls in a row, one of them with a count.
        await expectToFit(page, "practice board");

        await page.locator('[data-control="reveal"]').click();
        await page.getByTestId("game-confirm").locator('.mg-button[data-variant="primary"]').click();
        await expect(page.getByTestId("game-result")).toBeVisible({ timeout: 30_000 });
        await expectToFit(page, "practice result");
      });

      test(`${game}: the tutorial a new player sees`, async ({ page }) => {
        // Nothing seen yet: the tutorial opens over the first board.
        await page.addInitScript(([key]) => {
          const stored = JSON.parse(localStorage.getItem(key) ?? "{}") as { tutorials?: unknown };
          stored.tutorials = {};
          localStorage.setItem(key, JSON.stringify(stored));
        }, [SETTINGS_KEY]);
        await page.goto(inLocale(locale, `/${game}`));
        await expect(dialog(page)).toBeVisible({ timeout: 30_000 });
        await expectToFit(page, "tutorial");
      });
    }

    test("pages that are not games", async ({ page }) => {
      await page.goto(inLocale(locale, "/no-such-page"));
      await expect(page.locator("h1")).toBeVisible();
      await expectToFit(page, "not found");

      await page.goto(inLocale(locale, "/zip/play?seed=nonsense"));
      await expect(page.locator(".mg-shell")).toBeVisible();
      await expectToFit(page, "seed that cannot be played");
    });

    test("the ranking, with players on it", async ({ page, browser }) => {
      test.skip(!(await hasDatabase(page)), "the site runs without a database");
      const date = pacificDateKey(new Date());
      const score = (game: string, elapsedMs: number, hintsUsed: number) => ({ game, date, number: 1, difficulty: "medium", size: 6, elapsedMs, hintsUsed, mistakes: 0 });
      // Another player with the longest name the site accepts, a streak of hints and a slow time.
      const other = await browser.newContext();
      await other.request.post("/api/scores", { data: { ...score("zip", 3_725_000, 12), name: "Capivara Sonolenta 9" } });
      await other.close();
      await page.request.post("/api/scores", { data: score("zip", 83_000, 1) });
      await page.request.post("/api/scores", { data: score("queens", 150_000, 0) });

      await page.goto(inLocale(locale, "/ranking"));
      await expect(page.getByTestId("ranking-row").first()).toBeVisible();
      await expectToFit(page, "ranking of today");
      await page.getByTestId("ranking-week").click();
      await expect(page.getByTestId("ranking-row").first()).toBeVisible();
      await expectToFit(page, "ranking of the week");
      await page.getByTestId("ranking-today").click();
      await page.getByTestId("ranking-game-zip").click();
      await expect(page.getByTestId("ranking-row").first()).toBeVisible();
      await expectToFit(page, "ranking of one game");

      await page.getByTestId("profile-name").fill("Capivara Sonolenta 9");
      await expect(page.getByTestId("profile-save")).toBeVisible();
      await expectToFit(page, "profile being edited");

      await page.goto(inLocale(locale, "/"));
      await expect(page.getByTestId("hub-online").getByTestId("ranking-row").first()).toBeVisible();
      await expectToFit(page, "hub with a ranking");
    });

    test("a challenge room, from the setup to the final table", async ({ page, browser }) => {
      test.skip(!(await hasDatabase(page)), "the site runs without a database");

      // The setup with every round the slider allows, on the games with the longest names and options.
      await page.goto(inLocale(locale, "/rooms/new?game=sumbreak"));
      const slider = page.getByTestId("room-rounds");
      await slider.focus();
      await page.keyboard.press("End");
      await expect(page.getByTestId("room-round-10")).toBeVisible();
      await page.getByTestId("room-round-1").getByTestId("room-difficulty").selectOption("expert");
      await page.getByTestId("room-round-2").getByTestId("room-game").selectOption("termo");
      await page.getByTestId("room-round-3").getByTestId("room-game").selectOption("queens");
      await page.getByTestId("room-round-3").getByTestId("room-size").selectOption("10");
      await expect(page.getByTestId("game-language")).toBeVisible();
      await expectToFit(page, "room setup");

      // A room of three rounds, opened and played through the API: the layout is what is under test here, and rooms.spec.ts plays real boards.
      const rounds = [
        { game: "zip", difficulty: "easy", size: 5 },
        { game: "termo", difficulty: "expert", lang: locale },
        { game: "sumbreak", difficulty: "expert" },
      ];
      const opened = await page.request.post("/api/rooms", { data: { rounds, name: "Capivara Sonolenta 9" } });
      const code = ((await opened.json()) as { room: { code: string } }).room.code;
      const act = (context: BrowserContext | Page, body: Record<string, unknown>) => context.request.post(`/api/rooms/${code}`, { data: body });

      await page.goto(inLocale(locale, `/rooms/${code}`));
      await expect(page.getByTestId("room")).toHaveAttribute("data-status", "lobby");
      await expectToFit(page, "lobby, alone");

      const guest = await visitor(browser, locale);
      await guest.goto(inLocale(locale, `/rooms/${code}`));
      await expect(guest.getByTestId("room-join")).toBeVisible();
      await expect(guest.getByTestId("profile-name")).not.toHaveValue("");
      await expectToFit(guest, "invitation");
      await guest.getByTestId("room-join-button").click();
      await expect(guest.getByTestId("room-waiting")).toBeVisible();
      await expectToFit(guest, "lobby, as a guest");
      await expect(page.getByTestId("room-players").getByRole("listitem")).toHaveCount(2);
      await expectToFit(page, "lobby, as the host");

      // Six more players join, so the strip of the race has more faces than it can show.
      const crowd: BrowserContext[] = [];
      for (let extra = 0; extra < 6; extra++) {
        const device = await browser.newContext();
        await act(device, { action: "join" });
        crowd.push(device);
      }
      await expect(page.getByTestId("room-players").getByRole("listitem")).toHaveCount(8);
      await expectToFit(page, "lobby, full");

      // The race starts. The guest is taken to the first board, with the strip of the race over it.
      await act(page, { action: "start" });
      await expect(guest).toHaveURL(/round=1$/, { timeout: 30_000 });
      await expect(guest.locator('[data-control="hint"]')).toBeEnabled({ timeout: 30_000 });
      await expect(guest.getByTestId("race-clock")).toBeVisible();
      await expect(guest.getByTestId("race-player").first()).toBeVisible();
      await expectToFit(guest, "a round of a race");

      // The host plays every round at once, with hints: the guest is told at the top of the board.
      await act(page, { action: "progress", event: "view", round: 1 });
      await act(page, { action: "progress", event: "round", round: 1, solved: true, hints: 2 });
      await act(page, { action: "progress", event: "round", round: 2, solved: false, hints: 0 });
      await act(page, { action: "progress", event: "round", round: 3, solved: true, hints: 1 });
      await expect(guest.getByTestId("race-toast")).toBeVisible({ timeout: 30_000 });
      await expectToFit(guest, "news of a finished player");
      await guest.getByTestId("race-toast").locator("button").last().click();
      await expect(guest.getByTestId("race-confirm")).toBeVisible();
      await expectToFit(guest, "give up confirmation");
      await closeDialog(guest);

      // The table while the guest is still racing, and the host's wait.
      await page.goto(inLocale(locale, `/rooms/${code}`));
      await expect(page.getByTestId("room-standing")).toHaveCount(8);
      await expectToFit(page, "table during the race");
      await act(guest, { action: "progress", event: "round", round: 1, solved: true, hints: 0 });
      await guest.goto(inLocale(locale, `/rooms/${code}`));
      await expect(guest.getByTestId("room-go")).toBeVisible();
      await expectToFit(guest, "table with a round to go to");

      // The crowd leaves the race and the guest finishes it. The final table, then the offer of another race.
      for (const device of crowd) {
        await act(device, { action: "progress", event: "give-up" });
        await device.close();
      }
      await act(guest, { action: "progress", event: "round", round: 2, solved: true, hints: 0 });
      await act(guest, { action: "progress", event: "round", round: 3, solved: true, hints: 0 });
      for (const screen of [page, guest]) {
        await expect(screen.getByTestId("room")).toHaveAttribute("data-status", "finished", { timeout: 30_000 });
        await expect(screen.getByTestId("room-winner")).toBeVisible();
      }
      await expectToFit(page, "final table, as the host");
      await expectToFit(guest, "final table, as a guest");
      await page.getByTestId("room-rematch").click();
      await expect(guest.getByTestId("room-rematch-join")).toBeVisible({ timeout: 30_000 });
      await expectToFit(guest, "final table with a new room open");
      await guest.context().close();
    });
  });
}

/** Another player on another device, past the tutorials. */
async function visitor(browser: Browser, locale: Locale): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 360, height: PHONE_HEIGHT } });
  const page = await context.newPage();
  await skipTutorials(page, { gameLanguage: locale });
  return page;
}
