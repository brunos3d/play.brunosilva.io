import { type Page, type Request, expect, test } from "@playwright/test";
import { WEND_BANKS, getWendDailyPuzzle, wendLanguage, wendSeeds } from "@/games/wend/engine";
import { SETTINGS_KEY, inLocale, result, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, boardLetters, count, dragPath, foundTrails, lettersOf, openWend, row, solveByDragging, theme, wendPuzzle } from "./helpers";

/*
 * Wend has two languages that move apart. The interface locale is in the URL
 * and decides the sentences. The game language is a setting and decides the
 * words, and a seed carries the language of its own words.
 */

const english = wendPuzzle("e2e-wend-en", "easy", undefined, "en");
const portuguese = wendPuzzle("e2e-wend-en", "easy");
const TITLES = { en: WEND_BANKS.en.map((entry) => entry.title), "pt-br": WEND_BANKS["pt-br"].map((entry) => entry.title) };

/** Text that only one bank file holds: the first words of its first theme, as the bundler ships them. */
const BANK_MARKER = { "pt-br": WEND_BANKS["pt-br"][0].words.slice(0, 40), en: WEND_BANKS.en[0].words.slice(0, 40) };

/** Every script the page asks for, from the first request on. */
function watchScripts(page: Page): Request[] {
  const scripts: Request[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script" || new URL(request.url()).pathname.endsWith(".js")) scripts.push(request);
  });
  return scripts;
}

/**
 * Which word banks are among the scripts the page fetched, read from the
 * scripts themselves: chunk names are hashes and say nothing. `atLeast` guards
 * against a watcher that saw nothing, which would pass every "did not fetch".
 */
async function banksFetched(page: Page, scripts: readonly Request[], atLeast = 4): Promise<string[]> {
  const found = new Set<string>();
  const urls = [...new Set(scripts.map((request) => request.url()))];
  expect(urls.length).toBeGreaterThanOrEqual(atLeast);
  for (const url of urls) {
    const body = await (await page.request.get(url)).text();
    for (const [language, marker] of Object.entries(BANK_MARKER)) if (body.includes(marker)) found.add(language);
  }
  return [...found].sort();
}

const seedOf = (page: Page): string => new URL(page.url()).searchParams.get("seed") ?? "";

test("the fixtures are two different puzzles, one per language", () => {
  expect(english.puzzle.seed).toBe("WEND:e2e-wend-en:1:easy:en");
  expect(portuguese.puzzle.seed).toBe("WEND:e2e-wend-en:1:easy");
  expect(TITLES.en).toContain(english.puzzle.theme);
  expect(TITLES["pt-br"]).toContain(portuguese.puzzle.theme);
  expect(lettersOf(english.puzzle)).not.toBe(lettersOf(portuguese.puzzle));
  expect(BANK_MARKER.en).not.toBe(BANK_MARKER["pt-br"]);
});

test("an English board is found word by word and solved", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "en" });
  const problems = watchConsole(page);
  const { puzzle } = english;
  await openWend(page, english.url);
  await expect(page).toHaveURL(/\/en\/wend\/play/);
  expect(await boardLetters(page)).toBe(lettersOf(puzzle));
  await expect(theme(page)).toHaveText(`Theme: ${puzzle.theme}`);
  await expect(status(page)).toContainText(`Find ${puzzle.words.length} hidden words`);
  await expect(count(page)).toHaveText(`0 of ${puzzle.words.length}`);

  await dragPath(page, puzzle.size, puzzle.words[0].path);
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(row(page, 0)).toHaveText(puzzle.words[0].display);
  await expect(status(page)).toHaveText(`${puzzle.words[0].display}! ${puzzle.words.length - 1} words to go.`);

  await solveByDragging(page, puzzle, [0]);
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(status(page)).toHaveText("Solved. Every word found.");
  for (const [index, word] of puzzle.words.entries()) await expect(row(page, index)).toHaveText(word.display);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Flawless");
  expect(problems).toEqual([]);
});

test("an English link keeps its English words for a player who plays in Portuguese, and New stays in English", async ({ page }) => {
  // The default of these tests: the game language is Portuguese.
  await skipTutorials(page);
  const { puzzle } = english;
  await openWend(page, english.url);
  expect(await boardLetters(page)).toBe(lettersOf(puzzle));
  await expect(theme(page)).toHaveText(`Theme: ${puzzle.theme}`);
  await dragPath(page, puzzle.size, puzzle.words[0].path);
  await expect(row(page, 0)).toHaveText(puzzle.words[0].display);
  // The setting did not move: the link decided the words.
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").gameLanguage, SETTINGS_KEY)).toBe("pt-br");

  // Another board with the same difficulty, in the language of the one on screen.
  await page.getByTestId("game-new").click();
  await expect(page).not.toHaveURL(new RegExp(encodeURIComponent(puzzle.seed)));
  const next = wendSeeds.parse(seedOf(page))!;
  expect(wendLanguage(next)).toBe("en");
  expect(next.difficulty).toBe("easy");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(foundTrails(page)).toHaveCount(0);
  expect(TITLES.en.some((title) => title === wendPuzzle(next.token, next.difficulty, next.size, "en").puzzle.theme)).toBe(true);
  expect(await boardLetters(page)).toBe(lettersOf(wendPuzzle(next.token, next.difficulty, next.size, "en").puzzle));
});

test("the sentences follow the interface and the words follow the seed, in every combination", async ({ page }) => {
  await skipTutorials(page);
  const portugueseText = { start: "Encontre {n} palavras escondidas", themeLabel: "Tema:", counter: "de", found: "Falta", board: /^Tabuleiro do Wend, 5 por 5\./ };
  const englishText = { start: "Find {n} hidden words", themeLabel: "Theme:", counter: "of", found: "to go", board: /^Wend board, 5 by 5\./ };
  // A puzzle of its own for each combination, so none of them opens a board the one before already played.
  const combinations = [
    { locale: "pt-br", fixture: wendPuzzle("e2e-wend-mix-1", "easy", undefined, "en"), ...portugueseText },
    { locale: "en", fixture: wendPuzzle("e2e-wend-mix-2", "easy", undefined, "en"), ...englishText },
    { locale: "pt-br", fixture: wendPuzzle("e2e-wend-mix-3", "easy"), ...portugueseText },
    { locale: "en", fixture: wendPuzzle("e2e-wend-mix-4", "easy"), ...englishText },
  ] as const;
  for (const { locale, fixture, themeLabel, counter, found, board: label, ...text } of combinations) {
    const { puzzle } = fixture;
    const start = text.start.replace("{n}", String(puzzle.words.length));
    const where = `${locale} interface, ${puzzle.language} words`;
    expect(TITLES[puzzle.language], where).toContain(puzzle.theme);
    await openWend(page, inLocale(locale, fixture.url));
    await expect(page.locator("html"), where).toHaveAttribute("lang", locale === "en" ? "en" : "pt-BR");
    expect(await boardLetters(page), where).toBe(lettersOf(puzzle));
    await expect(status(page), where).toContainText(start);
    // The label is in the interface language and the title in the language of the words.
    await expect(theme(page), where).toHaveText(`${themeLabel} ${puzzle.theme}`);
    await expect(count(page), where).toHaveText(`0 ${counter} ${puzzle.words.length}`);
    await expect(board(page).getByRole("grid"), where).toHaveAccessibleName(label);
    const cell = puzzle.words[0].path[0];
    const place = locale === "en" ? `Row ${Math.floor(cell / 5) + 1}, column ${(cell % 5) + 1}. Letter ${puzzle.letters[cell]}.` : `Linha ${Math.floor(cell / 5) + 1}, coluna ${(cell % 5) + 1}. Letra ${puzzle.letters[cell]}.`;
    await expect(page.getByTestId(`wend-cell-${cell}`), where).toHaveAttribute("aria-label", place);

    await dragPath(page, puzzle.size, puzzle.words[0].path);
    await expect(foundTrails(page), where).toHaveCount(1);
    // The word keeps its own spelling inside a sentence of the interface.
    await expect(status(page), where).toContainText(`${puzzle.words[0].display}!`);
    await expect(status(page), where).toContainText(found);
    await expect(row(page, 0), where).toHaveAttribute("aria-label", locale === "en" ? `${puzzle.words[0].display}, found` : `${puzzle.words[0].display}, encontrada`);
  }
});

test("switching the interface keeps the board, its words and the progress", async ({ page }) => {
  // No game language chosen, so it follows the interface and changes with it. A seeded board must not care: its seed decides the words.
  await skipTutorials(page, { gameLanguage: null });
  const { puzzle } = english;
  await openWend(page, english.url);
  await dragPath(page, puzzle.size, puzzle.words[0].path);
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(count(page)).toHaveText(`1 of ${puzzle.words.length}`);

  await page.getByTestId("locale-switcher").getByRole("button").first().click();
  await page.getByRole("menuitemradio", { name: "Português (Brasil)" }).click();
  await expect(page).toHaveURL(new RegExp(`/pt-br/wend/play\\?seed=${encodeURIComponent(puzzle.seed)}$`));
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(puzzle));
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(count(page)).toHaveText(`1 de ${puzzle.words.length}`);
  await expect(theme(page)).toHaveText(`Tema: ${puzzle.theme}`);
  await expect(status(page)).toContainText(puzzle.words.length - 1 === 1 ? "Falta 1 palavra" : `Faltam ${puzzle.words.length - 1} palavras`);
  await page.getByRole("button", { name: /^Dica/ }).click();
  await expect(status(page)).toContainText("Primeira letra de uma palavra revelada.");
  // Still the same puzzle after everything settled: the interface switch did not send the page to a Portuguese board.
  await expect(page).toHaveURL(new RegExp(`/pt-br/wend/play\\?seed=${encodeURIComponent(puzzle.seed)}$`));
  expect(await boardLetters(page)).toBe(lettersOf(puzzle));
});

test("the practice setup picks the language of the words", async ({ page }) => {
  await skipTutorials(page);
  await page.goto("/wend/practice");
  const picker = page.getByTestId("game-language");
  await expect(picker.locator('[data-value="pt-br"]')).toHaveAttribute("aria-pressed", "true");

  // Portuguese, the player's setting: a seed with no language in it.
  await page.getByTestId("game-start").click();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  const first = wendSeeds.parse(seedOf(page))!;
  expect(seedOf(page)).not.toContain(":en");
  expect(wendLanguage(first)).toBe("pt-br");
  expect(await boardLetters(page)).toBe(lettersOf(wendPuzzle(first.token, first.difficulty).puzzle));
  await expect(theme(page)).toHaveText(`Theme: ${wendPuzzle(first.token, first.difficulty).puzzle.theme}`);

  // English: the picker is the game language setting, so it is remembered.
  await page.goto("/wend/practice");
  await page.getByTestId("game-language").locator('[data-value="en"]').click();
  await expect(page.getByTestId("game-language").locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").gameLanguage, SETTINGS_KEY)).toBe("en");
  await page.getByTestId("game-start").click();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(seedOf(page)).toMatch(/^WEND:[^:]+:1:medium:en$/);
  const second = wendSeeds.parse(seedOf(page))!;
  const expected = wendPuzzle(second.token, second.difficulty, undefined, "en").puzzle;
  expect(await boardLetters(page)).toBe(lettersOf(expected));
  expect(TITLES.en).toContain(expected.theme);
  await expect(theme(page)).toHaveText(`Theme: ${expected.theme}`);

  // A pasted seed keeps its own language, whatever the picker says.
  await page.goto("/wend/practice");
  await page.getByTestId("game-seed-input").fill(portuguese.puzzle.seed);
  await page.getByTestId("game-start").click();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(seedOf(page)).toBe(portuguese.puzzle.seed);
  expect(await boardLetters(page)).toBe(lettersOf(portuguese.puzzle));
});

test("the daily puzzle follows the game language, and the settings switch between the day's two puzzles", async ({ page }) => {
  await skipTutorials(page);
  const instant = new Date("2026-11-23T18:00:00Z");
  await page.clock.install({ time: instant });
  const daily = { "pt-br": getWendDailyPuzzle(instant).puzzle, en: getWendDailyPuzzle(instant, "en").puzzle };
  expect(daily.en.seed).toBe("WEND:2026-11-23:1:easy:en");

  await page.goto("/wend");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(daily["pt-br"]));
  await expect(theme(page)).toHaveText(`Theme: ${daily["pt-br"].theme}`);
  // Progress in Portuguese, to come back to.
  await dragPath(page, daily["pt-br"].size, daily["pt-br"].words[0].path);
  await expect(foundTrails(page)).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("settings-game-language").locator('[data-value="en"]').click();
  // The same day and the same number, with the English words. The interface did not move.
  await expect(theme(page)).toHaveText(`Theme: ${daily.en.theme}`);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(daily.en));
  await expect(page).toHaveURL(/\/en\/wend$/);
  await expect(foundTrails(page)).toHaveCount(0);
  await expect(page.getByText("#168")).toBeVisible();
  await expect(status(page)).toContainText(`Find ${daily.en.words.length} hidden words`);
  await dragPath(page, daily.en.size, daily.en.words[0].path);
  await expect(row(page, 0)).toHaveText(daily.en.words[0].display);

  // Each language keeps its own board: going back finds the Portuguese word still there.
  if (await page.getByTestId("game-settings").isHidden()) await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("settings-game-language").locator('[data-value="pt-br"]').click();
  await expect(theme(page)).toHaveText(`Theme: ${daily["pt-br"].theme}`);
  expect(await boardLetters(page)).toBe(lettersOf(daily["pt-br"]));
  await expect(foundTrails(page)).toHaveCount(1);
  await expect(row(page, 0)).toHaveText(daily["pt-br"].words[0].display);

  // A reload builds the stored language straight away, never the other one first.
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(daily["pt-br"]));
});

test("a player with no game language set plays the daily in the language of the interface", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: null });
  const instant = new Date("2026-11-23T18:00:00Z");
  await page.clock.install({ time: instant });
  await page.goto("/en/wend");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(getWendDailyPuzzle(instant, "en").puzzle));
  await page.goto("/pt-br/wend");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(getWendDailyPuzzle(instant).puzzle));
  await expect(theme(page)).toHaveText(`Tema: ${getWendDailyPuzzle(instant).puzzle.theme}`);
});

test("changing the game language on a practice puzzle moves to a new puzzle in that language", async ({ page }) => {
  await skipTutorials(page);
  const sized = wendPuzzle("e2e-wend-switch", "medium", 7);
  await openWend(page, sized.url);
  expect(await boardLetters(page)).toBe(lettersOf(sized.puzzle));

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("settings-game-language").locator('[data-value="en"]').click();
  await expect(page).toHaveURL(/seed=WEND%3A[^%]+%3A1%3Amedium%3A7%3Aen$/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  const next = wendSeeds.parse(seedOf(page))!;
  // A new random puzzle: same difficulty, same size, English words.
  expect(next).toMatchObject({ difficulty: "medium", size: 7, lang: "en" });
  expect(next.token).not.toBe("e2e-wend-switch");
  const expected = wendPuzzle(next.token, "medium", 7, "en").puzzle;
  expect(await boardLetters(page)).toBe(lettersOf(expected));
  await expect(theme(page)).toHaveText(`Theme: ${expected.theme}`);

  // It was a push: Back returns to the Portuguese puzzle, and its seed still decides the words.
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`seed=${encodeURIComponent(sized.puzzle.seed)}$`));
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await boardLetters(page)).toBe(lettersOf(sized.puzzle));
});

test("picking the language a shared puzzle is already in leaves the puzzle alone", async ({ page }) => {
  // A Portuguese player on an English link picks English: the board on screen is what they asked for.
  await skipTutorials(page);
  await openWend(page, english.url);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("settings-game-language").locator('[data-value="en"]').click();
  await expect(page.getByTestId("settings-game-language").locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(new RegExp(`seed=${encodeURIComponent(english.puzzle.seed)}$`));
  expect(await boardLetters(page)).toBe(lettersOf(english.puzzle));
});

test("the English tutorial teaches FIG and PEAR on the same little board", async ({ page }) => {
  await page.addInitScript(([key]) => localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, gameLanguage: "en", tutorials: {} })), [SETTINGS_KEY]);
  await page.goto("/wend");
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByRole("heading", { name: "How to play Wend" })).toBeVisible();
  expect(await boardLetters(page, "wend-tutorial-board")).toBe("FIG#RA#PE");
  await expect(tutorial.getByTestId("wend-theme")).toHaveText("Theme: Fruits");
  await expect(tutorial).toContainText("1. Connect the letters");
  await expect(tutorial).toContainText("The theme is fruit: start on the F and trace FIG along the top row.");
  await expect(tutorial.getByRole("grid")).toHaveAccessibleName("Tutorial board, 3 by 3");
  await expect(timer(page)).toHaveText("00:00");

  const grid = (await tutorial.getByRole("grid").boundingBox())!;
  const at = (cell: number) => ({ x: grid.x + ((cell % 3) + 0.5) * (grid.width / 3), y: grid.y + (Math.floor(cell / 3) + 0.5) * (grid.width / 3) });
  const trace = async (cells: readonly number[]) => {
    await page.mouse.move(at(cells[0]).x, at(cells[0]).y);
    await page.mouse.down();
    for (const cell of cells.slice(1)) await page.mouse.move(at(cell).x, at(cell).y, { steps: 3 });
    await page.mouse.up();
  };
  await trace([0, 1, 2]);
  await expect(tutorial.getByTestId("wend-row-0")).toHaveText("FIG");
  await expect(tutorial).toContainText("2. Words turn corners");
  await expect(tutorial).toContainText("One fruit of 4 letters is left, and it starts on the P.");
  // A hint speaks the interface language and reveals a letter of the English word.
  await tutorial.getByRole("button", { name: "Hint" }).click();
  await expect(tutorial).toContainText("First letter of a word revealed.");
  await expect(tutorial.getByTestId("wend-row-1")).toHaveText("P");
  await trace([7, 8, 5, 4]);
  await expect(tutorial.getByTestId("wend-row-1")).toHaveText("PEAR");
  await expect(tutorial).toContainText("That is the whole game");
  await tutorial.getByRole("button", { name: "Start playing" }).click();
  await expect(tutorial).toBeHidden();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});

test("the tutorial speaks Portuguese about an English board when the interface is Portuguese", async ({ page }) => {
  await page.addInitScript(([key]) => localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, gameLanguage: "en", tutorials: {} })), [SETTINGS_KEY]);
  await page.goto("/pt-br/wend");
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial.getByRole("heading", { name: "Como jogar Wend" })).toBeVisible();
  expect(await boardLetters(page, "wend-tutorial-board")).toBe("FIG#RA#PE");
  await expect(tutorial).toContainText("1. Ligue as letras");
  await expect(tutorial).toContainText("O tema é frutas: comece pelo F e trace FIG na linha de cima.");
  await expect(tutorial.getByTestId("wend-theme")).toHaveText("Tema: Fruits");
  await tutorial.getByRole("button", { name: "Pular" }).click();
  await expect(tutorial).toBeHidden();
});

test.describe("what a player downloads", () => {
  test("a Portuguese game never fetches the English word bank, and the reverse", async ({ page, browser }) => {
    await skipTutorials(page);
    const scripts = watchScripts(page);
    await openWend(page, portuguese.url);
    await dragPath(page, portuguese.puzzle.size, portuguese.puzzle.words[0].path);
    await expect(foundTrails(page)).toHaveCount(1);
    // The daily page and the practice setup, in the same language.
    await page.goto("/wend");
    await expect(board(page)).toHaveAttribute("data-locked", "false");
    await page.goto("/wend/practice");
    await page.getByTestId("game-start").click();
    await expect(board(page)).toHaveAttribute("data-locked", "false");
    expect(await banksFetched(page, scripts)).toEqual(["pt-br"]);

    // A player who only ever plays in English, in a browser of their own.
    const context = await browser.newContext();
    const other = await context.newPage();
    await skipTutorials(other, { gameLanguage: "en" });
    const otherScripts = watchScripts(other);
    await openWend(other, english.url);
    await dragPath(other, english.puzzle.size, english.puzzle.words[0].path);
    await expect(foundTrails(other)).toHaveCount(1);
    await other.goto("/wend");
    await expect(board(other)).toHaveAttribute("data-locked", "false");
    expect(await banksFetched(other, otherScripts)).toEqual(["en"]);
    await context.close();
  });

  test("the other bank arrives only when a puzzle in that language is opened", async ({ page }) => {
    await skipTutorials(page);
    const scripts = watchScripts(page);
    await openWend(page, portuguese.url);
    expect(await banksFetched(page, scripts)).toEqual(["pt-br"]);
    const before = scripts.length;
    // The player picks English: now, and only now, the English bank is fetched. The page was already loaded, so the bank is all that arrives.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByTestId("settings-game-language").locator('[data-value="en"]').click();
    await expect(page).toHaveURL(/%3Aen$/);
    await expect(board(page)).toHaveAttribute("data-locked", "false");
    expect(await banksFetched(page, scripts.slice(before), 1)).toEqual(["en"]);
    expect(await banksFetched(page, scripts)).toEqual(["en", "pt-br"]);
  });

  test("the hub and the practice setup fetch no word bank at all", async ({ page }) => {
    await skipTutorials(page);
    const scripts = watchScripts(page);
    await page.goto("/");
    await expect(page.getByTestId("hub-card-wend")).toBeVisible();
    await expect(page.getByTestId("hub-today-wend")).toContainText("#");
    await page.goto("/wend/practice");
    await expect(page.getByTestId("game-start")).toBeVisible();
    // Give prefetches of the links on screen time to finish.
    await page.waitForLoadState("networkidle");
    expect(await banksFetched(page, scripts)).toEqual([]);
  });
});
