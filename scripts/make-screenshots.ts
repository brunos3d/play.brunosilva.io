/**
 * npm run screenshots
 * Plays both games against a running production server and saves the README
 * images to .github/screenshots. Start the server first:
 *
 *   npm run build && npm start
 *   BASE_URL=http://localhost:3000 npm run screenshots
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Browser, type Page, chromium } from "@playwright/test";
import { getDailyPuzzle } from "@/games/patches/engine";
import { getZipDailyPuzzle } from "@/games/zip/engine";
import { draw, openPuzzle, practicePuzzle, targetsOf } from "../e2e/patches/helpers";
import { SETTINGS_KEY } from "../e2e/shared";
import { drawCells, openZip, zipPuzzle } from "../e2e/zip/helpers";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), ".github/screenshots");
const PHONE = { width: 390, height: 720 };

async function newPage(browser: Browser, colorScheme: "light" | "dark", height = PHONE.height): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: PHONE.width, height }, deviceScaleFactor: 2, colorScheme });
  await context.addInitScript(([key]) => {
    localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, tutorials: { zip: true, patches: true } }));
  }, [SETTINGS_KEY]);
  return context.newPage();
}

/** Lets entry animations finish, so nothing is caught half scaled. */
const settle = (page: Page) => page.waitForTimeout(700);

async function shootGames(browser: Browser, colorScheme: "light" | "dark", suffix: string): Promise<void> {
  const page = await newPage(browser, colorScheme);

  const zip = zipPuzzle("readme-16", "hard", 7);
  await openZip(page, zip.url);
  // Stop just short of the last hidden number, so the shot shows a covered "?" and one that is still unknown.
  const hidden = zip.puzzle.checkpoints.filter((checkpoint) => checkpoint.hidden);
  const lastHidden = hidden[hidden.length - 1];
  await drawCells(page, 7, zip.puzzle.solution.slice(0, zip.puzzle.solution.indexOf(lastHidden.row * 7 + lastHidden.column)));
  await settle(page);
  await page.screenshot({ path: resolve(OUT, `zip${suffix}.png`) });

  const patches = practicePuzzle("readme", "hard", 7);
  await openPuzzle(page, patches.url);
  for (const target of patches.targets.slice(0, Math.ceil(patches.targets.length * 0.65))) await draw(page, 7, target);
  await settle(page);
  await page.screenshot({ path: resolve(OUT, `patches${suffix}.png`) });

  await page.context().close();
}

/** The hub with real state: today's Zip solved, today's Patches opened and left with its clock running. */
async function shootHub(browser: Browser): Promise<void> {
  const page = await newPage(browser, "light", 800);
  const now = new Date();

  const zip = getZipDailyPuzzle(now).puzzle;
  await openZip(page, "/zip");
  await drawCells(page, zip.width, zip.solution);
  await page.getByTestId("game-result").waitFor();

  const patches = getDailyPuzzle(now).puzzle;
  await openPuzzle(page, "/patches");
  for (const target of targetsOf(patches).slice(0, 3)) await draw(page, patches.width, target);

  await page.goto("/");
  await page.getByTestId("hub-today-zip").getByText("Solved in").waitFor();
  await page.getByTestId("hub-today-patches").getByText("Clock running").waitFor();
  await settle(page);
  await page.screenshot({ path: resolve(OUT, "hub.png") });
  await page.context().close();
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  await shootHub(browser);
  await shootGames(browser, "light", "");
  await shootGames(browser, "dark", "-dark");
  await browser.close();
  console.log(`screenshots written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
