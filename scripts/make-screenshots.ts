/**
 * npm run screenshots
 * Plays every game against a running production server and saves the README
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
import { chessPuzzle, coach, openChess, tapMove } from "../e2e/chess/helpers";
import { draw, openPuzzle, practicePuzzle, targetsOf } from "../e2e/patches/helpers";
import { openQueens, placeQueen, queensPuzzle } from "../e2e/queens/helpers";
import { SETTINGS_KEY } from "../e2e/shared";
import { openSumbreak, playMerges, sumbreakPuzzle } from "../e2e/sumbreak/helpers";
import { guess, openTermo, row as termoRow, termoPuzzle, wrongWords } from "../e2e/termo/helpers";
import { dragPath, foundTrails, openWend, wendPuzzle } from "../e2e/wend/helpers";
import { drawCells, openZip, zipPuzzle } from "../e2e/zip/helpers";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), ".github/screenshots");
const PHONE = { width: 390, height: 720 };

async function newPage(browser: Browser, colorScheme: "light" | "dark", height = PHONE.height): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: PHONE.width, height }, deviceScaleFactor: 2, colorScheme, locale: "en-US" });
  await context.addInitScript(([key]) => {
    // English throughout, like the README: the interface by the browser's language, the games by this setting.
    localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, theme: "system", gameLanguage: "en", tutorials: { zip: true, patches: true, chess: true, queens: true, sumbreak: true, wend: true, termo: true } }));
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

  // A fork that wins a piece, one move in: the coach has praised the first move and asks for the next.
  const chess = chessPuzzle("readme-9", "medium");
  await openChess(page, chess.url);
  await tapMove(page, chess.puzzle, chess.resolved.line[0]);
  await coach(page).getByText("Your opponent replied").first().waitFor();
  await settle(page);
  await page.screenshot({ path: resolve(OUT, `chess${suffix}.png`) });

  const queens = queensPuzzle("readme", "hard", 8);
  await openQueens(page, queens.url);
  for (const cell of queens.puzzle.solution.slice(0, 5)) await placeQueen(page, 8, cell);
  await settle(page);
  await page.screenshot({ path: resolve(OUT, `queens${suffix}.png`) });

  const sumbreak = sumbreakPuzzle("readme", "hard", 4);
  await openSumbreak(page, sumbreak.url);
  await playMerges(page, sumbreak.puzzle, sumbreak.puzzle.solution.slice(0, 5));
  await settle(page);
  await page.screenshot({ path: resolve(OUT, `sumbreak${suffix}.png`) });

  // Three words found and a fourth half traced.
  const wend = wendPuzzle("readme", "hard", undefined, "en");
  await openWend(page, wend.url);
  for (const word of wend.puzzle.words.slice(0, 3)) await dragPath(page, wend.puzzle.size, word.path);
  await foundTrails(page).nth(2).waitFor();
  await dragPath(page, wend.puzzle.size, wend.puzzle.words[3].path.slice(0, 4));
  await settle(page);
  await page.screenshot({ path: resolve(OUT, `wend${suffix}.png`) });

  // Two words at once, three guesses in.
  const termo = termoPuzzle("readme", "hard", "en");
  await openTermo(page, termo.url);
  for (const [index, word] of wrongWords(termo.puzzle, 3).entries()) {
    await guess(page, word);
    await termoRow(page, index).and(page.locator('[data-kind="played"]')).first().waitFor();
  }
  // The tiles of the last row turn over one after the other. Wait for all five.
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: resolve(OUT, `termo${suffix}.png`) });

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
