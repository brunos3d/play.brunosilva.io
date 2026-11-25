import { expect, test } from "@playwright/test";
import { SETTINGS_KEY, skipTutorials, status } from "../shared";
import { drawCells, openZip, visited, zipPuzzle } from "../zip/helpers";

const zip = zipPuzzle("e2e-i18n", "easy", 5);

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

const storedSettings = (page: import("@playwright/test").Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}") as { theme?: string; gameLanguage?: string | null }, SETTINGS_KEY);

test.describe("a path without a locale", () => {
  test("is redirected by the country, then by the browser's languages, and the cookie beats both", async ({ playwright, baseURL }) => {
    // Each request is a new visitor: a shared context would keep the locale cookie of the answer before.
    const get = async (path: string, headers: Record<string, string>) => {
      const visitor = await playwright.request.newContext({ baseURL });
      const response = await visitor.get(path, { headers, maxRedirects: 0 });
      await visitor.dispose();
      return response;
    };
    const target = (response: Awaited<ReturnType<typeof get>>) => new URL(response.headers().location, "http://localhost");

    const brazil = await get("/", { "x-vercel-ip-country": "BR", "accept-language": "en-US" });
    expect(brazil.status()).toBe(307);
    expect(target(brazil).pathname).toBe("/pt-br");
    expect(brazil.headers()["set-cookie"]).toContain("NEXT_LOCALE=pt-br");
    // The answer depends on who asks, so no shared cache may keep it.
    expect(brazil.headers()["cache-control"]).toContain("no-store");

    expect(target(await get("/termo", { "x-vercel-ip-country": "US", "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" })).pathname).toBe("/pt-br/termo");
    expect(target(await get("/termo", { "x-vercel-ip-country": "DE", "accept-language": "de-DE,de;q=0.9" })).pathname).toBe("/en/termo");
    expect(target(await get("/", { "x-vercel-ip-country": "BR", cookie: "NEXT_LOCALE=en" })).pathname).toBe("/en");

    // A shared link keeps its query string on the way.
    const seeded = target(await get(`/zip/play?seed=${encodeURIComponent(zip.puzzle.seed)}`, { "accept-language": "pt-BR" }));
    expect(`${seeded.pathname}${seeded.search}`).toBe(`/pt-br/zip/play?seed=${encodeURIComponent(zip.puzzle.seed)}`);
  });

  test("leaves a path that names a locale alone, and files have none", async ({ request }) => {
    const portuguese = await request.get("/en/zip", { headers: { "x-vercel-ip-country": "BR", "accept-language": "pt-BR" }, maxRedirects: 0 });
    expect(portuguese.status()).toBe(200);
    expect(portuguese.headers()["set-cookie"]).toContain("NEXT_LOCALE=en");
    for (const file of ["/sw.js", "/manifest.webmanifest", "/icons/zip.svg", "/og/home.png"]) {
      expect((await request.get(file, { headers: { "accept-language": "pt-BR" }, maxRedirects: 0 })).status(), file).toBe(200);
    }
  });

  test.describe("in a Portuguese browser", () => {
    test.use({ locale: "pt-BR" });

    test("opens the site in Portuguese", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/pt-br$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
      await expect(page.getByTestId("hub-today-zip")).toContainText("Ainda não jogado");
      await expect(page.getByTestId("hub-card-chess").getByRole("heading")).toHaveText("Xadrez");
      await expect(page.getByTestId("hub-card-zip").getByRole("link", { name: /Jogar o desafio de hoje/ })).toBeVisible();
    });
  });
});

test("the language menu in the header switches the interface and stays on the same puzzle", async ({ page, context }) => {
  await openZip(page, zip.url);
  await expect(page).toHaveURL(/\/en\/zip\/play/);
  await drawCells(page, 5, zip.puzzle.solution.slice(0, 4));
  await expect(status(page)).toContainText("4 of");

  const switcher = page.getByTestId("locale-switcher");
  await switcher.getByRole("button", { name: "Interface language: English" }).click();
  await expect(switcher.getByRole("menuitemradio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  await switcher.getByRole("menuitemradio", { name: "Português (Brasil)" }).click();

  // Same puzzle, same progress, another language.
  await expect(page).toHaveURL(new RegExp(`/pt-br/zip/play\\?seed=${encodeURIComponent(zip.puzzle.seed)}$`));
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(visited(page)).toHaveCount(4);
  await expect(status(page)).toContainText("4 de");
  await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Diário" })).toBeVisible();

  // The messages of the game itself follow: a hint explains itself in Portuguese.
  await page.getByRole("button", { name: /^Dica/ }).click();
  await expect(status(page)).toContainText("Este é o único caminho até o");

  // The choice is remembered: a bare path now opens in Portuguese, although the browser asks for English.
  expect((await context.cookies()).find((cookie) => cookie.name === "NEXT_LOCALE")?.value).toBe("pt-br");
  await page.goto("/");
  await expect(page).toHaveURL(/\/pt-br$/);

  // Escape closes the menu without choosing.
  await page.getByTestId("locale-switcher").getByRole("button").first().click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page).toHaveURL(/\/pt-br$/);
});

test("the settings offer the interface language and the game language as two separate choices", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: null });
  await page.goto("/en");
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByTestId("game-settings");
  const gameLanguage = settings.getByTestId("settings-game-language");
  const interfaceLanguage = settings.getByTestId("settings-interface-language");

  // Until the player picks one, games are played in the language of the interface.
  await expect(interfaceLanguage.locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  await expect(gameLanguage.locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");

  // Picking a game language does not move the interface.
  await gameLanguage.locator('[data-value="pt-br"]').click();
  await expect(gameLanguage.locator('[data-value="pt-br"]')).toHaveAttribute("aria-pressed", "true");
  await expect(interfaceLanguage.locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/en$/);
  await expect(settings.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect((await storedSettings(page)).gameLanguage).toBe("pt-br");

  // And switching the interface does not move the game language.
  await interfaceLanguage.locator('[data-value="pt-br"]').click();
  await expect(page).toHaveURL(/\/pt-br$/);
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByTestId("settings-interface-language").locator('[data-value="en"]').click();
  await expect(page).toHaveURL(/\/en$/);
  expect((await storedSettings(page)).gameLanguage).toBe("pt-br");
});

test("only the hub and the games that depend on a language offer the game language", async ({ page }) => {
  for (const [path, offered] of [["/zip", false], ["/queens", false], ["/chess", true], ["/wend", true], ["/termo", true]] as const) {
    await page.goto(path);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByTestId("settings-theme"), path).toBeVisible();
    await expect(page.getByTestId("settings-game-language"), path).toHaveCount(offered ? 1 : 0);
  }
});

test.describe("theme", () => {
  test("follows the device until the player picks one", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/zip");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--linen").trim())).toBe("#f6f1e7");
  });

  test("the button in the header switches between light and dark, and the choice survives a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/zip");
    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle).toHaveAccessibleName("Switch to the dark theme");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAccessibleName("Switch to the light theme");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--linen").trim())).toBe("#1d1a17");
    expect((await storedSettings(page)).theme).toBe("dark");
    // The browser's own chrome follows the theme picked by hand.
    expect(await page.locator('meta[name="theme-color"]').first().getAttribute("content")).toBe("#1d1a17");

    // Dark stays dark on a light device, on every page, from the first paint.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("the settings choose between the device's theme, light and dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/zip");
    await page.getByRole("button", { name: "Settings" }).click();
    const theme = page.getByTestId("settings-theme");
    await expect(theme.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
    await theme.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await theme.getByRole("button", { name: "System" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect((await storedSettings(page)).theme).toBe("system");
  });
});

test("the header fits a 360 px screen in both languages, with every button a thumb can hit", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const locale of ["en", "pt-br"]) {
    // Sumbreak has the longest name, and a daily number next to it.
    await page.goto(`/${locale}/sumbreak`);
    await expect(page.getByTestId("sumbreak-board")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, locale).toBe(0);
    const actions = page.locator(".mg-header-actions").getByRole("button");
    await expect(actions).toHaveCount(4);
    for (const button of await actions.all()) {
      const box = (await button.boundingBox())!;
      expect(box.height, locale).toBeGreaterThanOrEqual(44);
      expect(box.width, locale).toBeGreaterThanOrEqual(34);
      expect(box.x + box.width, locale).toBeLessThanOrEqual(360);
    }
    const title = (await page.getByTestId("game-home").boundingBox())!;
    const first = (await actions.first().boundingBox())!;
    expect(title.x + title.width, locale).toBeLessThanOrEqual(first.x);
  }
});

test("a page that does not exist says so in the visitor's language", async ({ page }) => {
  const english = await page.goto("/en/no-such-page");
  expect(english?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page does not exist" })).toBeVisible();
  const portuguese = await page.goto("/pt-br/no-such-page");
  expect(portuguese?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página não existe" })).toBeVisible();
  await page.getByRole("link", { name: "Ver todos os jogos" }).click();
  await expect(page).toHaveURL(/\/pt-br$/);
});
