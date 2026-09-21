import type { Page } from "@playwright/test";

export const SETTINGS_KEY = "minigames:settings:v1";

/** Most tests start past the tutorials and with sound off. The tutorials have their own tests. */
export async function skipTutorials(page: Page): Promise<void> {
  await page.addInitScript(([key]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, tutorials: { zip: true, patches: true } }));
  }, [SETTINGS_KEY]);
}

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
