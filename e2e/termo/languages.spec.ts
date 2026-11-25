import { type Page, expect, test } from "@playwright/test";
import { answerWords, displayWord, generateTermoFromSpec, getTermoDailyInfo, scoreGuess, termoDailyVariantSpec } from "@/games/termo/engine";
import { SETTINGS_KEY, inLocale, result, skipTutorials, status, watchConsole } from "../shared";
import { board, grid, guess, key, openTermo, row, rowMarks, rowText, termoPuzzle, wrongWords } from "./helpers";

/**
 * Termo in two languages. The words follow the game language, or the seed of
 * a shared link. The text around them follows the interface locale. The two
 * are independent, and each language's word list is fetched only when a
 * puzzle of that language is opened.
 */
const english = termoPuzzle("e2e-termo-en-1", "medium", "en");
const englishDuo = termoPuzzle("e2e-termo-en-2", "hard", "en");
const portuguese = termoPuzzle("e2e-termo-pt-1", "medium");
const portugueseDuo = termoPuzzle("e2e-termo-pt-2", "hard");

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

/** The start of each language's answer list, as it sits in the script that carries it. No other script holds these letters. */
const LIST_MARK = { "pt-br": answerWords("pt-br").slice(0, 4).join(""), en: answerWords("en").slice(0, 4).join("") } as const;

/** Watches the scripts a page fetches and tells which word lists were among them. */
function watchWordLists(page: Page): () => Promise<string[]> {
  const scripts: Promise<string>[] = [];
  page.on("request", (request) => {
    if (!/\/_next\/static\/.+\.js(\?|$)/.test(request.url())) return;
    scripts.push(
      request
        .response()
        .then((response) => response?.text() ?? "")
        .catch(() => ""),
    );
  });
  return async () => {
    const bodies = await Promise.all(scripts);
    expect(bodies.length).toBeGreaterThan(0);
    return (["en", "pt-br"] as const).filter((language) => bodies.some((body) => body.includes(LIST_MARK[language])));
  };
}

const storedGameLanguage = (page: Page) => page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}") as { gameLanguage?: string | null }).gameLanguage, SETTINGS_KEY);

async function closeResult(page: Page): Promise<void> {
  await expect(result(page)).toBeVisible();
  await result(page).getByRole("button", { name: "Close" }).click();
  await expect(result(page)).toBeHidden();
}

/** Picks a game language in the settings dialog of the page that is open. */
async function pickGameLanguage(page: Page, language: "en" | "pt-br", settingsLabel = "Settings"): Promise<void> {
  await page.getByRole("button", { name: settingsLabel }).click();
  await page.getByTestId("game-settings").getByTestId("settings-game-language").locator(`[data-value="${language}"]`).click();
  await expect.poll(() => storedGameLanguage(page)).toBe(language);
}

test("a whole game in English: English words are accepted, marked and win", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "en" });
  const problems = watchConsole(page);
  const lists = watchWordLists(page);
  const answer = english.puzzle.answers[0];
  const [miss] = wrongWords(english.puzzle, 1);
  expect(english.puzzle.seed).toBe("TERMO:e2e-termo-en-1:1:medium:en");

  await openTermo(page, english.url);
  await expect(page).toHaveURL(/\/en\/termo\/play\?seed=TERMO%3Ae2e-termo-en-1%3A1%3Amedium%3Aen$/);
  await expect(status(page)).toContainText("Find the word in 6 guesses. Type a 5-letter word and press Enter.");

  // A Portuguese word is not a word of this puzzle.
  await guess(page, "festa");
  await expect(status(page)).toContainText("That word is not in the list.");
  await expect(row(page, 0)).toHaveAttribute("data-kind", "current");
  await page.keyboard.press("Delete");

  await guess(page, miss);
  expect(await rowMarks(page, 0)).toEqual(scoreGuess(answer, miss));
  expect(await rowText(page, 0)).toBe(miss.toUpperCase());
  await expect(status(page)).toContainText("Guess 2 of 6.");

  await guess(page, answer);
  expect(await rowText(page, 1)).toBe(answer.toUpperCase());
  await expect(status(page)).toContainText("You got it in 2 guesses.");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Solved without hints");
  expect(problems).toEqual([]);
  // Only the English list travelled.
  expect(await lists()).toEqual(["en"]);
});

test("an English game can be lost and revealed, and names its English words", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "en" });
  await openTermo(page, english.url);
  for (const word of wrongWords(english.puzzle, 6)) await guess(page, word);
  await expect(status(page)).toContainText(`Out of guesses. The word was ${english.puzzle.answers[0].toUpperCase()}.`);
  await expect(board(page).getByTestId("termo-answer")).toHaveText(english.puzzle.answers[0].toUpperCase());

  const [first, other] = englishDuo.puzzle.answers;
  await openTermo(page, englishDuo.url);
  await guess(page, first);
  await expect(status(page)).toContainText(`${first.toUpperCase()} found. 1 word to go.`);
  await page.getByRole("button", { name: "Reveal" }).click();
  await page.getByTestId("game-confirm").getByRole("button", { name: "Reveal" }).click();
  await expect(status(page)).toContainText(`Solution revealed. The words were ${first.toUpperCase()} and ${other.toUpperCase()}.`);
});

test("a shared English seed opens English words for a player who plays in Portuguese, and New stays in English", async ({ page }) => {
  // `skipTutorials` pins the game language to Portuguese.
  const lists = watchWordLists(page);
  const answer = english.puzzle.answers[0];
  const [miss] = wrongWords(english.puzzle, 1);
  await openTermo(page, english.url);
  expect(await storedGameLanguage(page)).toBe("pt-br");

  await guess(page, miss);
  expect(await rowMarks(page, 0)).toEqual(scoreGuess(answer, miss));
  await guess(page, "festa");
  await expect(status(page)).toContainText("That word is not in the list.");
  await page.keyboard.press("Delete");
  await guess(page, answer);
  await expect(status(page)).toContainText("You got it in 2 guesses.");
  await expect(result(page)).toBeVisible();
  // The seed decided the language, so the Portuguese list was never fetched.
  expect(await lists()).toEqual(["en"]);

  // "New" keeps the language of the puzzle on screen, not the one in the settings.
  await result(page).getByRole("button", { name: "Close" }).click();
  await page.getByTestId("game-new").click();
  await expect(page).toHaveURL(/seed=TERMO%3A[^%]+%3A1%3Amedium%3Aen$/);
  await expect(page).not.toHaveURL(/e2e-termo-en-1/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await guess(page, miss);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
  expect(await storedGameLanguage(page)).toBe("pt-br");
});

test("the interface in Portuguese with English words", async ({ page }) => {
  const answer = english.puzzle.answers[0];
  const [miss] = wrongWords(english.puzzle, 1);
  await openTermo(page, inLocale("pt-br", english.url));
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(status(page)).toContainText("Descubra a palavra em 6 tentativas. Digite uma palavra de 5 letras e aperte Enter.");
  await expect(board(page)).toHaveAccessibleName("Termo: uma palavra de 5 letras, 6 tentativas.");
  await expect(key(page, "clear")).toHaveText("limpar");
  await expect(key(page, "clear")).toHaveAccessibleName("Limpar todas as letras da linha");
  await expect(key(page, "backspace")).toHaveAccessibleName("Apagar letra");
  await expect(key(page, "enter")).toHaveAccessibleName("Enviar palavra");

  await page.keyboard.type("hou");
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("A palavra precisa ter 5 letras.");
  await page.keyboard.press("Delete");
  await guess(page, "festa");
  await expect(status(page)).toContainText("Essa palavra não está na lista.");
  await page.keyboard.press("Delete");

  await guess(page, miss);
  await expect(status(page)).toContainText("Tentativa 2 de 6.");
  const marks = scoreGuess(answer, miss);
  const text = { right: "no lugar certo", place: "em outra posição", wrong: "fora da palavra" };
  await expect(row(page, 0).getByTestId("termo-tile").nth(0)).toHaveAccessibleName(`${miss[0].toUpperCase()}, ${text[marks[0]]}`);
  await page.getByRole("button", { name: /^Dica/ }).click();
  await expect(status(page)).toContainText(/^A \dª letra é [A-Z]\.$/);
  await guess(page, answer);
  await expect(status(page)).toContainText("Você acertou em 2 tentativas.");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Resolvido");
});

test("the interface in English with Portuguese words, and in Portuguese with Portuguese words", async ({ page }) => {
  const answer = portuguese.puzzle.answers[0];
  await openTermo(page, inLocale("en", portuguese.url));
  await expect(status(page)).toContainText("Find the word in 6 guesses.");
  // An English word is not a word of a Portuguese puzzle.
  await guess(page, "house");
  await expect(status(page)).toContainText("That word is not in the list.");

  await openTermo(page, inLocale("pt-br", portuguese.url));
  // The same board, saved on the device: the row typed in the other interface is still there.
  expect(await rowText(page, 0)).toBe("HOUSE");
  await page.keyboard.press("Delete");
  await guess(page, answer);
  await expect(status(page)).toContainText("De primeira! Você acertou a palavra.");

  const [first] = portugueseDuo.puzzle.answers;
  await openTermo(page, inLocale("pt-br", portugueseDuo.url));
  await expect(status(page)).toContainText("Descubra as 2 palavras em 7 tentativas.");
  await expect(grid(page, 1)).toHaveAccessibleName("Palavra 2 de 2");
  await guess(page, first);
  await expect(status(page)).toContainText("encontrada. Falta 1 palavra.");
  await expect(grid(page, 0)).toHaveAccessibleName("Palavra 1 de 2, encontrada");
});

test("the tutorial explains in the interface language with example words of the game language", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, tutorials: {} })), SETTINGS_KEY);
  const tutorial = page.getByTestId("game-tutorial");
  const examples = tutorial.locator(".termo-example");

  // English words, explained in Portuguese. English has no accents, so the note about them is left out.
  await page.goto(inLocale("pt-br", english.url));
  await expect(tutorial).toContainText("Como jogar Termo");
  await expect(examples).toHaveText(["PLANT", "HOUSE", "MONEY"]);
  await expect(tutorial).toContainText("A letra P está na palavra e no lugar certo.");
  await expect(tutorial).toContainText("A letra U está na palavra, mas em outra posição.");
  await expect(tutorial).toContainText("A letra E não está na palavra.");
  await expect(tutorial).not.toContainText("cedilha");
  await expect(examples.nth(0).locator(".termo-tile").nth(0)).toHaveAttribute("data-mark", "right");
  await expect(examples.nth(1).locator(".termo-tile").nth(2)).toHaveAttribute("data-mark", "place");
  await expect(examples.nth(2).locator(".termo-tile").nth(3)).toHaveAttribute("data-mark", "wrong");
  await expect(tutorial.getByRole("button", { name: "Começar a jogar" })).toBeVisible();

  // Portuguese words, explained in English, with the note about accents.
  await page.goto(inLocale("en", portuguese.url));
  await expect(tutorial).toContainText("How to play Termo");
  await expect(examples).toHaveText(["FESTA", "CAMPO", "NUVEM"]);
  await expect(tutorial).toContainText("The letter F is in the word and in the right place.");
  await expect(tutorial).toContainText("Accents and the cedilla are not typed.");

  // English and English.
  await page.goto(inLocale("en", english.url));
  await expect(examples).toHaveText(["PLANT", "HOUSE", "MONEY"]);
  await expect(tutorial).toContainText("The letter U is in the word, but in another position.");
  await expect(tutorial).not.toContainText("cedilla");
  await tutorial.getByRole("button", { name: "Start playing" }).click();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});

test("practice picks the language of the words, and a pasted seed keeps its own", async ({ page }) => {
  const picked = termoPuzzle("idioma", "medium", "en");
  await page.goto("/termo/practice");
  const picker = page.getByTestId("game-language");
  await expect(picker.locator('[data-value="pt-br"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("The same seed, mode and language always hide the same words.")).toBeVisible();

  await picker.locator('[data-value="en"]').click();
  await expect(picker.locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  expect(await storedGameLanguage(page)).toBe("en");
  await page.getByTestId("game-seed-input").fill("idioma");
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/\/en\/termo\/play\?seed=TERMO%3Aidioma%3A1%3Amedium%3Aen$/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await guess(page, picked.puzzle.answers[0]);
  await expect(status(page)).toContainText("First try! You got the word.");

  // The choice is the platform's game language setting, so it is still there.
  await page.goto("/termo/practice");
  await expect(picker.locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  // A random puzzle is in the picked language and mode.
  await page.getByTestId("termo-mode-dueto").click();
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/seed=TERMO%3A[^%]+%3A1%3Ahard%3Aen$/);
  await expect(board(page)).toHaveAttribute("data-boards", "2");

  // A canonical seed names its own language. Here it names none, which is Portuguese, and the picker does not change that.
  await page.goto("/termo/practice");
  await page.getByTestId("game-seed-input").fill(portugueseDuo.puzzle.seed);
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/seed=TERMO%3Ae2e-termo-pt-2%3A1%3Ahard$/);
  await expect(board(page)).toHaveAttribute("data-boards", "2");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await guess(page, portugueseDuo.puzzle.answers[0]);
  await expect(grid(page, 0)).toHaveAttribute("data-solved", "true");

  // In Portuguese the same screen reads in Portuguese.
  await page.goto(inLocale("pt-br", "/termo/practice"));
  await expect(page.getByText("Modo", { exact: true })).toBeVisible();
  await expect(page.getByTestId("termo-mode-summary")).toHaveText("Termo: 1 palavra, 6 tentativas.");
  await page.getByTestId("termo-mode-quarteto").click();
  await expect(page.getByTestId("termo-mode-summary")).toHaveText("Quarteto: 4 palavras ao mesmo tempo, 9 tentativas.");
  await expect(page.getByTestId("termo-mode-quarteto")).toHaveAccessibleName("Quarteto: 4 palavras ao mesmo tempo, 9 tentativas.");
});

test("each language has its own daily: the settings switch between them, and one result does not close the other", async ({ page }) => {
  // 10:00 in the Pacific zone.
  await page.clock.install({ time: new Date("2026-11-29T18:00:00Z") });
  const date = "2026-11-29";
  const inPortuguese = generateTermoFromSpec(getTermoDailyInfo(date, "pt-br").spec).answers[0];
  const inEnglish = generateTermoFromSpec(getTermoDailyInfo(date, "en").spec).answers[0];
  expect(inEnglish).not.toBe(inPortuguese);

  await page.goto("/termo");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await guess(page, inPortuguese);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Termo #8");
  await result(page).getByRole("button", { name: "Close" }).click();
  await expect(board(page)).toHaveAttribute("data-locked", "true");

  // The same day in English is another puzzle, and it is still open.
  await pickGameLanguage(page, "en");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(page).toHaveURL(/\/en\/termo$/);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "current");
  await expect(status(page)).toContainText("Find the word in 6 guesses.");
  await expect(page.getByTestId("termo-next")).toHaveCount(0);
  const [miss] = wrongWords(generateTermoFromSpec(getTermoDailyInfo(date, "en").spec), 1);
  await guess(page, miss);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
  await guess(page, inEnglish);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Termo #8");
  // The day's Dueto offered here is the English one.
  await expect(result(page).getByTestId("termo-result-next-dueto")).toHaveAttribute("href", new RegExp(`seed=TERMO%3A${date}-dueto%3A1%3Ahard%3Aen$`));
  await result(page).getByRole("button", { name: "Close" }).click();

  // Both are finished now, each with its own board and result. A finished board reopens with its result on top.
  await page.reload();
  await closeResult(page);
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  expect(await rowText(page, 1)).toBe(inEnglish.toUpperCase());
  await expect(status(page)).toContainText("You got it in 2 guesses.");
  await pickGameLanguage(page, "pt-br");
  await closeResult(page);
  await expect(status(page)).toContainText("First try! You got the word.");
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  expect(await rowText(page, 0)).toBe(displayWord(inPortuguese, "pt-br").toUpperCase());
  await expect(page.getByTestId("termo-next-dueto")).toHaveAttribute("href", new RegExp(`seed=TERMO%3A${date}-dueto%3A1%3Ahard$`));

  // The English Dueto of the day follows the English Termo.
  await pickGameLanguage(page, "en");
  await closeResult(page);
  await expect(status(page)).toContainText("You got it in 2 guesses.");
  await page.getByTestId("termo-next-dueto").click();
  await expect(page).toHaveURL(new RegExp(`seed=TERMO%3A${date}-dueto%3A1%3Ahard%3Aen$`));
  await expect(board(page)).toHaveAttribute("data-boards", "2");
  const dueto = generateTermoFromSpec(termoDailyVariantSpec(date, "dueto", "en"));
  expect(dueto.answers).not.toContain(inEnglish);
  await guess(page, dueto.answers[0]);
  await expect(grid(page, 0)).toHaveAttribute("data-solved", "true");
  await guess(page, dueto.answers[1]);
  await expect(result(page)).toBeVisible();
  await result(page).getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("termo-next").getByRole("link")).toHaveText(["Play the daily Termo", "Play the daily Quarteto", "Practice"]);
  await expect(page.getByTestId("termo-next-quarteto")).toHaveAttribute("href", new RegExp(`seed=TERMO%3A${date}-quarteto%3A1%3Aexpert%3Aen$`));
});

test("changing the game language on a practice puzzle moves to a new puzzle of the same mode in that language", async ({ page }) => {
  await openTermo(page, portugueseDuo.url);
  await guess(page, wrongWords(portugueseDuo.puzzle, 1)[0]);
  await pickGameLanguage(page, "en");
  await expect(page).toHaveURL(/seed=TERMO%3A[^%]+%3A1%3Ahard%3Aen$/);
  await expect(page).not.toHaveURL(/e2e-termo-pt-2/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(board(page)).toHaveAttribute("data-boards", "2");
  await expect(row(page, 0)).toHaveAttribute("data-kind", "current");
  // English words now.
  await guess(page, "house");
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");

  // And back: a Portuguese puzzle again, still two words.
  await pickGameLanguage(page, "pt-br");
  await expect(page).toHaveURL(/seed=TERMO%3A[^%]+%3A1%3Ahard$/);
  await expect(board(page)).toHaveAttribute("data-boards", "2");
  await guess(page, "festa");
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");

  // The puzzle left behind is still saved under its own seed.
  await openTermo(page, portugueseDuo.url);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
});

test("changing the game language on the day's Dueto opens the same day's Dueto in that language", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-29T18:00:00Z") });
  const date = "2026-11-29";
  await openTermo(page, `/termo/play?seed=${encodeURIComponent(`TERMO:${date}-dueto:1:hard`)}`);
  await expect(page.getByTestId("game-new")).toHaveCount(0);
  await pickGameLanguage(page, "en");
  await expect(page).toHaveURL(new RegExp(`seed=TERMO%3A${date}-dueto%3A1%3Ahard%3Aen$`));
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(page.getByTestId("game-new")).toHaveCount(0);
  const dueto = generateTermoFromSpec(termoDailyVariantSpec(date, "dueto", "en"));
  await guess(page, dueto.answers[1]);
  await expect(grid(page, 1)).toHaveAttribute("data-solved", "true");
});

test("a puzzle that is already in the language just picked stays where it is", async ({ page }) => {
  // The player plays in Portuguese and opened an English link. Picking English in the settings changes nothing here.
  await openTermo(page, english.url);
  await guess(page, wrongWords(english.puzzle, 1)[0]);
  await pickGameLanguage(page, "en");
  await page.getByTestId("game-settings").getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/seed=TERMO%3Ae2e-termo-en-1%3A1%3Amedium%3Aen$/);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
});

test("each word list is fetched only when its language is played, and the hub and the setup screen fetch none", async ({ page, browser }) => {
  const lists = watchWordLists(page);
  await page.goto("/");
  await expect(page.getByTestId("hub-card-termo")).toBeVisible();
  await expect(page.getByTestId("hub-today-termo")).toBeVisible();
  await page.goto("/termo/practice");
  await expect(page.getByTestId("game-language")).toBeVisible();
  expect(await lists()).toEqual([]);

  // A Portuguese puzzle fetches the Portuguese list and nothing of the English one.
  await openTermo(page, portuguese.url);
  await guess(page, wrongWords(portuguese.puzzle, 1)[0]);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
  expect(await lists()).toEqual(["pt-br"]);

  // An English player, in a browser of their own, gets the English list and nothing of the Portuguese one.
  const other = await (await browser.newContext()).newPage();
  await skipTutorials(other, { gameLanguage: "en" });
  const otherLists = watchWordLists(other);
  await other.goto("/termo");
  await expect(other.getByTestId("termo-board")).toHaveAttribute("data-locked", "false");
  await other.keyboard.type("house");
  await other.keyboard.press("Enter");
  await expect(other.locator('[data-testid="termo-row"][data-row="0"]')).toHaveAttribute("data-kind", "played");
  expect(await otherLists()).toEqual(["en"]);
  await other.context().close();

  // The second list arrives the moment a puzzle of that language is opened.
  await openTermo(page, english.url);
  expect(await lists()).toEqual(["en", "pt-br"]);
});

test("a language played online once keeps playing offline, and a list that cannot be fetched says so", async ({ page, context }) => {
  // The offline worker takes control and stores the pages of this locale.
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 150; i++) {
      const paths: string[] = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
      if (navigator.serviceWorker.controller && paths.includes("/__sw/precached/en") && paths.includes("/en/termo/play")) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("service worker did not finish precaching");
  });

  // One Portuguese puzzle online. Its word list goes through the worker, which keeps it.
  await openTermo(page, portuguese.url);
  await guess(page, wrongWords(portuguese.puzzle, 1)[0]);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");

  await context.setOffline(true);
  // Another Portuguese seed, never seen online: the page and the list both come from the worker.
  await openTermo(page, portugueseDuo.url);
  await guess(page, wrongWords(portugueseDuo.puzzle, 1)[0]);
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");

  // English was never played, so its list is not on the device. That is not a bad seed.
  await page.goto(english.url);
  const unavailable = page.getByTestId("termo-words-unavailable");
  await expect(unavailable).toContainText("The word list could not be loaded");
  await expect(page.getByText("This seed cannot be played")).toHaveCount(0);
  await expect(unavailable.getByRole("button", { name: "Try again" })).toBeVisible();

  // Back online, trying again loads it.
  await context.setOffline(false);
  await unavailable.getByRole("button", { name: "Try again" }).click();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await guess(page, english.puzzle.answers[0]);
  await expect(status(page)).toContainText("First try! You got the word.");
});
