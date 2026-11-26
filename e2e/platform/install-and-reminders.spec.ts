import { type Page, devices, expect, test } from "@playwright/test";
import { E2E_CRON_SECRET } from "../../playwright.config";
import { skipTutorials } from "../shared";
import { sql } from "./database";
import { createAccount, device, score, signIn } from "./passkeys";
import { OTHER_PUSH_KEYS, PUSH_KEYS } from "./push";

/**
 * Installing the site as an app, and the reminders of a streak about to end.
 *
 * A test browser cannot install anything or receive a push. What can be
 * tested is everything around those two moments: when the invitation shows,
 * what it does with the browser's install event, what the server takes as a
 * subscription, and who the scheduled route decides to remind. The route runs
 * dry in tests (PUSH_DRY_RUN): it marks who was due and sends nothing.
 */
const OFFERS_KEY = "minigames:offers:v1";

/** What Chrome on Android does when a site can be installed. `window.installAsked` counts the times the dialog was opened. */
async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    const state = window as unknown as { installAsked?: number };
    event.prompt = async () => {
      state.installAsked = (state.installAsked ?? 0) + 1;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
}

const banner = (page: Page) => page.getByTestId("app-banner");

test.describe("on an Android phone", () => {
  test.use({ userAgent: devices["Pixel 7"].userAgent, viewport: devices["Pixel 7"].viewport, hasTouch: true });

  test("the home screen invites the player to install, in its own words, and remembers a no", async ({ page }) => {
    await skipTutorials(page);
    await page.goto("/");
    await expect(page.getByTestId("hub-card-zip")).toBeVisible();
    // Nothing is offered until the browser says the site can be installed.
    await expect(banner(page)).toHaveCount(0);
    await offerInstall(page);
    await expect(banner(page)).toHaveAttribute("data-kind", "prompt");
    await expect(banner(page)).toContainText("Install Minigames");
    await expect(banner(page)).toContainText("even without a connection");

    // "Not now" is remembered: the same event, later, shows nothing.
    await page.getByTestId("app-banner-later").click();
    await expect(banner(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("hub-card-zip")).toBeVisible();
    await offerInstall(page);
    await page.waitForTimeout(400);
    await expect(banner(page)).toHaveCount(0);

    // The settings keep the way in.
    await page.locator(".mg-header-actions > button").last().click();
    await expect(page.getByTestId("settings-install")).toContainText("Install Minigames");
    await page.getByTestId("settings-install").getByRole("button", { name: "Install" }).click();
    expect(await page.evaluate(() => (window as unknown as { installAsked?: number }).installAsked)).toBe(1);
    await expect(page.getByTestId("settings-install")).toHaveCount(0);
  });

  test("accepting opens the browser's install dialog, once, and reads in Portuguese", async ({ page }) => {
    await skipTutorials(page);
    await page.goto("/pt-br");
    await expect(page.getByTestId("hub-card-zip")).toBeVisible();
    await offerInstall(page);
    await expect(banner(page)).toContainText("Instalar o Minigames");
    await expect(page.getByTestId("app-banner-later")).toHaveText("Agora não");
    await page.getByTestId("app-banner-accept").click();
    await expect(banner(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { installAsked?: number }).installAsked)).toBe(1);
    expect(await page.evaluate((key) => localStorage.getItem(key), OFFERS_KEY)).toContain("install");
  });

  test("the invitation waits for the cookie notice to be answered", async ({ browser }) => {
    const context = await browser.newContext({ userAgent: devices["Pixel 7"].userAgent, viewport: devices["Pixel 7"].viewport, hasTouch: true, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await skipTutorials(page);
    await page.goto("/");
    await expect(page.getByTestId("consent")).toBeVisible();
    await offerInstall(page);
    await page.waitForTimeout(400);
    await expect(banner(page)).toHaveCount(0);
    await page.getByTestId("consent-accept").click();
    await expect(banner(page)).toHaveAttribute("data-kind", "prompt");
    await context.close();
  });
});

test("an iPhone is told how to install, since its browser has no dialog for it", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: devices["iPhone 14"].userAgent, viewport: devices["iPhone 14"].viewport, hasTouch: true });
  const page = await context.newPage();
  await skipTutorials(page);
  await page.goto("/");
  await expect(banner(page)).toHaveAttribute("data-kind", "ios");
  await expect(banner(page)).toContainText("Share");
  await expect(banner(page)).toContainText("Add to Home Screen");
  // There is nothing to press but "Got it": the install happens in the browser's own menu.
  await expect(page.getByTestId("app-banner-accept")).toHaveCount(0);
  await page.getByTestId("app-banner-later").click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("hub-card-zip")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(banner(page)).toHaveCount(0);
  await context.close();
});

test("a computer is not invited to install", async ({ browser }) => {
  // Everything a phone would say about itself is turned off: the mobile project would otherwise lend this context its own.
  const context = await browser.newContext({ userAgent: devices["Desktop Chrome"].userAgent, viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });
  const page = await context.newPage();
  await skipTutorials(page);
  await page.goto("/");
  await expect(page.getByTestId("hub-card-zip")).toBeVisible();
  await offerInstall(page);
  await page.waitForTimeout(400);
  await expect(banner(page)).toHaveCount(0);
  await context.close();
});

test.describe("reminders", () => {
  test.beforeEach(async ({ request }) => {
    test.skip((await request.get("/api/session")).status() === 503, "the site runs without a database");
  });

  const keys = PUSH_KEYS;
  const endpointOf = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}:APA91b${"x".repeat(40)}`;
  const unique = () => Math.random().toString(36).slice(2, 14);

  test("a device subscribes for its player, and only with what a browser's push service gives it", async ({ request, playwright, baseURL }) => {
    const answer = (await (await request.get("/api/push")).json()) as { key: string | null };
    expect(answer.key).toMatch(/^[A-Za-z0-9_-]{80,}$/);

    const endpoint = endpointOf(unique());
    const body = { subscription: { endpoint, keys }, locale: "pt-br", timezone: "America/Sao_Paulo" };
    // A reminder is about a player's streak: without a player there is nobody to remind.
    expect((await request.post("/api/push", { data: body })).status()).toBe(401);
    await request.post("/api/session", { data: { name: "Ana" } });

    // The server posts to the endpoint, so it has to be a push service and nothing else.
    for (const hostile of ["https://evil.example/hook", "http://fcm.googleapis.com/fcm/send/x", "https://169.254.169.254/latest/meta-data/", "https://fcm.googleapis.com.evil.example/x", "https://localhost:5432/"]) {
      expect((await request.post("/api/push", { data: { ...body, subscription: { endpoint: hostile, keys } } })).status(), hostile).toBe(400);
    }
    expect((await request.post("/api/push", { data: { ...body, timezone: "'; drop table players; --" } })).status()).toBe(400);
    expect((await request.post("/api/push", { data: { ...body, locale: "xx" } })).status()).toBe(400);

    expect((await request.post("/api/push", { data: body })).status()).toBe(200);
    const subscribed = async (who = request) => ((await (await who.post("/api/push", { data: { action: "status", endpoint } })).json()) as { subscribed: boolean }).subscribed;
    expect(await subscribed()).toBe(true);
    // Asking again updates the same subscription: a device does it when its language changes.
    expect((await request.post("/api/push", { data: { ...body, locale: "en" } })).status()).toBe(200);
    expect(await sql("select locale from {schema}.push_subscriptions where endpoint = $1", [endpoint])).toEqual([{ locale: "en" }]);

    // Someone who learned the endpoint, and not the keys that go with it, can neither take the subscription for their
    // own player nor end it.
    const thief = await playwright.request.newContext({ baseURL });
    await thief.post("/api/session", { data: { name: "Mallory" } });
    const taken = await thief.post("/api/push", { data: { ...body, subscription: { endpoint, keys: OTHER_PUSH_KEYS } } });
    // Refused out loud: a device must never believe it is subscribed when it is not.
    expect(taken.status()).toBe(409);
    expect(await taken.json()).toEqual({ error: "subscription-refused" });
    expect(await subscribed(thief)).toBe(false);
    await thief.delete("/api/push", { data: { endpoint } });
    await thief.delete("/api/push", { data: { endpoint, auth: OTHER_PUSH_KEYS.auth } });
    // A key that has the right shape and is not a point of the curve could never be sent to. It is refused at the door.
    expect((await thief.post("/api/push", { data: { ...body, subscription: { endpoint: endpointOf(unique()), keys: { ...keys, p256dh: "B".repeat(87) } } } })).status()).toBe(400);
    expect(await subscribed()).toBe(true);
    await thief.dispose();

    // The device itself, which has both, ends it.
    expect((await request.delete("/api/push", { data: { endpoint, auth: keys.auth } })).status()).toBe(200);
    expect(await subscribed()).toBe(false);

    // A player keeps eight devices. The ninth takes the place of the oldest.
    const devices = Array.from({ length: 9 }, () => endpointOf(unique()));
    for (const [index, device] of devices.entries()) {
      expect((await request.post("/api/push", { data: { ...body, subscription: { endpoint: device, keys } } })).status()).toBe(200);
      await sql("update {schema}.push_subscriptions set created_at = now() - make_interval(mins => $2::int) where endpoint = $1", [device, 9 - index]);
    }
    const kept = (await sql<{ endpoint: string }>("select endpoint from {schema}.push_subscriptions where endpoint = any($1::text[])", [devices])).map((row) => row.endpoint);
    expect(kept.sort()).toEqual(devices.slice(1).sort());
  });

  test("the home screen offers reminders to a player with a streak, and the offer and the settings switch agree", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await skipTutorials(page);
    // A test browser has no push service. This stands in for one: permission is granted when asked, and subscribing
    // hands out a subscription shaped like Chrome's.
    const endpoint = endpointOf(unique());
    await page.addInitScript(
      ({ endpoint, keys }) => {
        let permission: NotificationPermission = "default";
        let subscription: unknown = null;
        Object.defineProperty(Notification, "permission", { get: () => permission });
        Notification.requestPermission = async () => (permission = "granted");
        const fake = { endpoint, toJSON: () => ({ endpoint, keys }), unsubscribe: async () => ((subscription = null), true) };
        PushManager.prototype.getSubscription = async () => subscription as PushSubscription | null;
        PushManager.prototype.subscribe = async () => (subscription = fake) as unknown as PushSubscription;
      },
      { endpoint, keys },
    );
    const id = ((await (await page.request.post("/api/session", { data: { name: "Streaky" } })).json()) as { player: { id: string } }).player.id;
    await sql("update {schema}.players set streak_current = 5, streak_best = 5, streak_date = (now() at time zone 'America/Los_Angeles')::date where id = $1", [id]);
    const rows = async () => (await sql<{ rows: number }>("select count(*)::int as rows from {schema}.push_subscriptions where player_id = $1", [id]))[0].rows;

    await page.goto("/en");
    await expect(banner(page)).toHaveAttribute("data-offer", "reminders");
    // The banner is named by its title, with the streak in it.
    await expect(page.getByRole("complementary", { name: "Keep your 5 day streak" })).toBeVisible();
    await expect(banner(page)).toContainText("while there is still time to play");

    // Turned on in the settings, on the same screen: the offer has nothing left to ask.
    await page.getByRole("button", { name: "Settings" }).click();
    const toggle = page.getByTestId("settings-reminders");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(banner(page)).toHaveCount(0);
    expect(await rows()).toBe(1);

    // Turned off again: the server forgets the device, and the offer is back.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect.poll(rows).toBe(0);
    await expect(banner(page)).toHaveAttribute("data-offer", "reminders");

    // Accepted from the banner this time. The switch in the settings is on without having been touched.
    await page.keyboard.press("Escape");
    await page.getByTestId("app-banner-accept").click();
    await expect(banner(page)).toHaveCount(0);
    expect(await rows()).toBe(1);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByTestId("settings-reminders")).toHaveAttribute("aria-checked", "true");
    expect(errors).toEqual([]);
  });

  test("reminders follow the player: a device player's go to the account it joins, and stop when the account signs its devices out", async ({ page, browser }) => {
    // An account, made on a phone.
    await skipTutorials(page);
    const credential = await createAccount(page);
    const account = ((await (await page.request.get("/api/session")).json()) as { player: { id: string } }).player.id;

    // A computer with a device player of its own, a score, and reminders on.
    const computer = await device(browser);
    await computer.request.post("/api/scores", { data: score("zip", 61_000) });
    const ghost = ((await (await computer.request.get("/api/session")).json()) as { player: { id: string } }).player.id;
    const endpoint = endpointOf(unique());
    expect((await computer.request.post("/api/push", { data: { subscription: { endpoint, keys }, locale: "en", timezone: "UTC" } })).status()).toBe(200);
    const owner = async () => (await sql<{ player_id: string }>("select player_id::text from {schema}.push_subscriptions where endpoint = $1", [endpoint]))[0]?.player_id ?? null;
    expect(await owner()).toBe(ghost);

    // It signs in to the account and brings its scores along. The reminders come too, instead of going with the device player.
    await signIn(computer, credential);
    await computer.getByTestId("account-merge-button").click();
    await expect(computer.getByTestId("account-notice")).toHaveAttribute("data-kind", "merged");
    expect(await owner()).toBe(account);

    // The phone signs the other devices out. The computer stops being reminded about an account it is no longer in.
    expect((await page.request.post("/api/account/logout", { data: { everywhere: true } })).status()).toBe(200);
    expect(await owner()).toBeNull();
    await computer.context().close();
  });

  test("the scheduled route reminds a player whose streak ends today, once, at their hour, and nobody else", async ({ request, playwright, baseURL }) => {
    // Nobody but the scheduler may call it. A token of the right length in another alphabet is a wrong token, not an error.
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);
    expect((await request.get("/api/cron/reminders", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    expect((await request.get("/api/cron/reminders", { headers: { authorization: `Bearer ${"\u00e9".repeat(E2E_CRON_SECRET.length)}` } })).status()).toBe(401);
    // A dry run can be told the time. This one is 19:05 in Sao Paulo and 07:05 in Tokyo, with ten hours of the day left.
    const run = async () =>
      (await (await request.get("/api/cron/reminders?at=2026-11-26T22:05:00Z", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } })).json()) as { due: number; sent: number; dry: boolean };
    const zone = (hour: 19 | 7): string => (hour === 19 ? "America/Sao_Paulo" : "Asia/Tokyo");

    const player = async (name: string, timezone: string, streak: { days: number; lastDay: "yesterday" | "today" | "last week" }) => {
      const device = await playwright.request.newContext({ baseURL });
      const id = ((await (await device.post("/api/session", { data: { name } })).json()) as { player: { id: string } }).player.id;
      const endpoint = endpointOf(unique());
      expect((await device.post("/api/push", { data: { subscription: { endpoint, keys }, locale: "pt-br", timezone } })).status()).toBe(200);
      const ago = streak.lastDay === "yesterday" ? 1 : streak.lastDay === "today" ? 0 : 7;
      await sql("update {schema}.players set streak_current = $2, streak_best = $2, streak_date = (now() at time zone 'America/Los_Angeles')::date - $3::int where id = $1", [id, streak.days, ago]);
      await device.dispose();
      return endpoint;
    };
    const sentTo = async (endpoint: string) => ((await sql<{ last_sent: string | null }>("select last_sent::text from {schema}.push_subscriptions where endpoint = $1", [endpoint]))[0]?.last_sent ?? null) !== null;

    const atRisk = await player("Evening", zone(19), { days: 4, lastDay: "yesterday" });
    const morning = await player("Morning", zone(7), { days: 4, lastDay: "yesterday" });
    const played = await player("Played", zone(19), { days: 4, lastDay: "today" });
    const lapsed = await player("Lapsed", zone(19), { days: 4, lastDay: "last week" });

    // The run takes every device that is due, this test's and any other's, so its counts are not this test's to assert.
    const first = await run();
    expect(first.dry).toBe(true);
    // The one whose streak ends today, where it is evening: reminded.
    expect(await sentTo(atRisk)).toBe(true);
    // It is morning there, they already played today, or their streak ended days ago: left alone.
    expect(await sentTo(morning)).toBe(false);
    expect(await sentTo(played)).toBe(false);
    expect(await sentTo(lapsed)).toBe(false);

    // The next run, an hour later, does not remind the same device again: it does not touch the row at all. Postgres
    // gives a row a new `xmin` whenever a statement writes it, so an unchanged one means nothing did.
    const version = async () => (await sql<{ version: string }>("select xmin::text as version from {schema}.push_subscriptions where endpoint = $1", [atRisk]))[0]?.version;
    const untouched = await version();
    await run();
    expect(await version()).toBe(untouched);
    expect(await sql("select count(*)::int as rows from {schema}.push_subscriptions where endpoint = $1 and last_sent = (now() at time zone 'America/Los_Angeles')::date", [atRisk])).toEqual([{ rows: 1 }]);
  });
});
