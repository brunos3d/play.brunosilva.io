import type { Page } from "@playwright/test";

export const SETTINGS_KEY = "minigames:settings:v1";
/** Where the answer to the cookie notice is kept. playwright.config.ts starts every test with it answered. */
export const CONSENT_KEY = "minigames:consent:v1";

export type TestSettings = { gameLanguage?: "en" | "pt-br" | null; theme?: "system" | "light" | "dark" };

/**
 * Most tests start past the tutorials and with sound off. The tutorials have
 * their own tests.
 *
 * The browser asks for English, so the interface is in English (/en). The
 * game language is pinned to Portuguese unless a test asks otherwise: the
 * words of Termo and Wend and the coach's lines in the older tests are
 * Portuguese. Pass `gameLanguage: null` to let the games follow the interface,
 * as they do for a new player.
 *
 * Settings already on the device are kept, so what a test changes survives a
 * reload. A call that passes `settings` replaces them once, on the first page
 * load, which is how a test overrides the defaults of its file's `beforeEach`.
 */
export async function skipTutorials(page: Page, settings?: TestSettings): Promise<void> {
  const stored = { sound: false, haptics: false, theme: "system", gameLanguage: "pt-br", ...settings, tutorials: { zip: true, patches: true, chess: true, queens: true, sumbreak: true, wend: true, termo: true } };
  await page.addInitScript(([key, value, replace]) => {
    const marker = `e2e:${value}`;
    if (!localStorage.getItem(key) || (replace === "yes" && !sessionStorage.getItem(marker))) localStorage.setItem(key, value);
    sessionStorage.setItem(marker, "1");
  }, [SETTINGS_KEY, JSON.stringify(stored), settings ? "yes" : "no"]);
}

/** The path of a page in a locale: `inLocale("pt-br", "/zip")` is "/pt-br/zip". A bare path is redirected to the browser's language, which is English in these tests. */
export const inLocale = (locale: "en" | "pt-br", path: string): string => `/${locale}${path === "/" ? "" : path}`;

export const status = (page: Page) => page.getByTestId("game-status");
export const timer = (page: Page) => page.getByTestId("game-timer");
export const result = (page: Page) => page.getByTestId("game-result");

/** Seconds shown by an MM:SS timer. */
export const seconds = (text: string): number => {
  const [minutes, rest] = text.trim().split(":").map(Number);
  return minutes * 60 + rest;
};

/** Collects console errors, warnings and uncaught exceptions for the "clean console" assertions. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

export async function confirmReveal(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Reveal" }).click();
  await page.getByTestId("game-confirm").getByRole("button", { name: "Reveal" }).click();
}
