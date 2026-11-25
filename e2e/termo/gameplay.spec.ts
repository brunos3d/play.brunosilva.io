import { expect, test } from "@playwright/test";
import { displayWord, generateTermoFromSpec, getTermoDailyInfo, plainLetters, scoreGuess, termoDailyVariantSpec } from "@/games/termo/engine";
import { confirmReveal, result, seconds, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, grid, guess, key, keyboard, openTermo, row, rowMarks, rowText, tapGuess, termoPuzzle, tiles, wrongWords } from "./helpers";

/**
 * The game itself. The words are Portuguese here and the interface is English,
 * which is what `skipTutorials` sets up: the two languages are independent.
 * Everything about choosing a language is in languages.spec.ts.
 */
const { puzzle, url } = termoPuzzle("e2e-termo-1", "medium");
const answer = puzzle.answers[0];
const [miss, second] = wrongWords(puzzle, 2);
const duo = termoPuzzle("e2e-termo-2", "hard");
const quartet = termoPuzzle("e2e-termo-4", "expert");
/** A word as the board and the status line write it: with its accents, in capitals. */
const shown = (word: string): string => displayWord(word, "pt-br").toUpperCase();

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("a typed guess is marked letter by letter, and the right word wins", async ({ page }) => {
  const problems = watchConsole(page);
  await openTermo(page, url);
  await expect(status(page)).toContainText("Find the word in 6 guesses");
  await expect(board(page).getByTestId("termo-grid")).toHaveCount(1);
  await expect(board(page).getByTestId("termo-row")).toHaveCount(6);

  await guess(page, miss);
  expect(await rowMarks(page, 0)).toEqual(scoreGuess(answer, miss));
  expect(await rowText(page, 0)).toBe(shown(miss));
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
  await expect(row(page, 1)).toHaveAttribute("data-kind", "current");
  await expect(status(page)).toContainText("Guess 2 of 6");

  await guess(page, answer);
  expect(await rowMarks(page, 1)).toEqual(["right", "right", "right", "right", "right"]);
  // The row shows the word as it is written, accents included.
  expect(await rowText(page, 1)).toBe(shown(answer));
  await expect(status(page)).toContainText("You got it in 2 guesses");
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Solved without hints");
  const stats = result(page).locator(".mg-stat");
  await expect(stats.nth(1)).toContainText("Misses");
  await expect(stats.nth(1)).toContainText("1");
  await expect(stats.nth(2)).toContainText("2");
  expect(problems).toEqual([]);
});

test("the on-screen keyboard types, erases one letter, clears the row and colours its keys", async ({ page }) => {
  await openTermo(page, url);
  for (const letter of "fest") await key(page, letter).click();
  expect(await rowText(page, 0)).toBe("FEST");
  await key(page, "backspace").click();
  expect(await rowText(page, 0)).toBe("FES");
  await key(page, "clear").click();
  expect(await rowText(page, 0)).toBe("");
  await expect(tiles(page, 0).nth(0)).toHaveAttribute("data-cursor", "true");

  await tapGuess(page, miss);
  const marks = scoreGuess(answer, miss);
  for (let index = 0; index < miss.length; index++) {
    // A letter that appears twice keeps its best mark, so only check letters that appear once.
    if (miss.indexOf(miss[index]) !== miss.lastIndexOf(miss[index])) continue;
    await expect(key(page, miss[index])).toHaveAttribute("data-mark", marks[index]);
  }
  await expect(keyboard(page).locator(".termo-key[data-mark]")).not.toHaveCount(0);
});

test("the board, its tiles and the keys are labelled for a screen reader in the interface language", async ({ page }) => {
  await openTermo(page, url);
  await expect(board(page)).toHaveAccessibleName("Termo: one 5-letter word, 6 guesses.");
  await expect(grid(page)).toHaveAccessibleName("Guesses");
  await expect(row(page, 0)).toHaveAccessibleName("Guess 1");
  await expect(keyboard(page)).toHaveAccessibleName("Keyboard");
  await expect(key(page, "backspace")).toHaveAccessibleName("Erase letter");
  await expect(key(page, "clear")).toHaveAccessibleName("Clear every letter of the row");
  await expect(key(page, "clear")).toHaveText("clear");
  await expect(key(page, "enter")).toHaveAccessibleName("Play the word");
  await expect(tiles(page, 0).nth(0)).toHaveAccessibleName("Position 1: empty, cursor");
  await expect(tiles(page, 1).nth(0)).toHaveAccessibleName("empty");

  await page.keyboard.type(miss.slice(0, 1));
  await expect(tiles(page, 0).nth(0)).toHaveAccessibleName(`Position 1: ${miss[0].toUpperCase()}`);
  await page.keyboard.press("Delete");
  await guess(page, miss);
  const marks = scoreGuess(answer, miss);
  const text = { right: "in the right place", place: "in another position", wrong: "not in the word" };
  await expect(tiles(page, 0).nth(0)).toHaveAccessibleName(`${shown(miss)[0]}, ${text[marks[0]]}`);
  // A letter that appears once in the guess has one mark, and its key says the same.
  const once = [...miss].findIndex((letter) => miss.indexOf(letter) === miss.lastIndexOf(letter));
  await expect(key(page, miss[once])).toHaveAccessibleName(`${miss[once].toUpperCase()}, ${text[marks[once]]}`);
});

test("a short row and an unknown word are refused, each with its message", async ({ page }) => {
  await openTermo(page, url);
  await page.keyboard.type("fes");
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("The word needs 5 letters.");
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");

  await page.keyboard.type("xx");
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("That word is not in the list.");
  await expect(row(page, 0)).toHaveAttribute("data-kind", "current");
  expect(await rowText(page, 0)).toBe("FESXX");

  // Delete clears the row, and typing takes the message away.
  await page.keyboard.press("Delete");
  expect(await rowText(page, 0)).toBe("");
  await page.keyboard.type("a");
  await expect(status(page)).not.toHaveAttribute("data-kind", "invalid");
});

test("the cursor moves with the arrows and with a tap, and letters go where it is", async ({ page }) => {
  await openTermo(page, url);
  await page.keyboard.type("festa");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(tiles(page, 0).nth(3)).toHaveAttribute("data-cursor", "true");
  await page.keyboard.type("r");
  expect(await rowText(page, 0)).toBe("FESRA");

  await tiles(page, 0).nth(0).click();
  await expect(tiles(page, 0).nth(0)).toHaveAttribute("data-cursor", "true");
  await page.keyboard.type("t");
  expect(await rowText(page, 0)).toBe("TESRA");
  await page.keyboard.press("Backspace");
  expect(await rowText(page, 0)).toBe("TESR");
});

test("Z and H are letters here: they type and do not fire the frame's shortcuts", async ({ page }) => {
  await openTermo(page, url);
  await page.keyboard.type("zh");
  expect(await rowText(page, 0)).toBe("ZH");
  await expect(page.getByRole("button", { name: "Hint. 0 used." })).toBeVisible();
  // A guess is final, so the frame shows no Undo and no Reset.
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toHaveCount(0);
});

test("a hint gives one letter in its place and is counted", async ({ page }) => {
  await openTermo(page, url);
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText(`The 1st letter is ${answer[0].toUpperCase()}.`);
  await expect(tiles(page, 0).nth(0)).toHaveAttribute("data-hint", "true");
  await expect(tiles(page, 0).nth(0)).toHaveText(answer[0].toUpperCase());
  await expect(tiles(page, 0).nth(0)).toHaveAccessibleName(`Position 1: empty, hint ${answer[0].toUpperCase()}, cursor`);
  await expect(page.getByRole("button", { name: "Hint. 1 used." })).toBeVisible();

  // The hint stays for the next row, and a second hint moves on to the next letter.
  await guess(page, miss);
  await expect(tiles(page, 1).nth(0)).toHaveAttribute("data-hint", "true");
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(page.getByRole("button", { name: "Hint. 2 used." })).toBeVisible();
  await guess(page, answer);
  await expect(result(page)).toContainText("Solved");
  await expect(result(page).locator(".mg-stat").nth(0)).toContainText("2");
});

test("running out of guesses ends the game and shows the word", async ({ page }) => {
  await openTermo(page, url);
  for (const word of wrongWords(puzzle, 6)) await guess(page, word);
  await expect(status(page)).toContainText(`Out of guesses. The word was ${shown(answer)}.`);
  await expect(board(page).getByTestId("termo-answer")).toHaveText(shown(answer));
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Out of guesses");
  await expect(result(page)).toContainText("does not count toward your streak");
  // A lost game can still be shared: its grid shows how close it came.
  await expect(result(page).getByRole("button", { name: /Share/ })).toBeVisible();
});

test("reveal shows the word and ends the game", async ({ page }) => {
  await openTermo(page, url);
  await guess(page, miss);
  await confirmReveal(page);
  await expect(status(page)).toContainText(`Solution revealed. The word was ${shown(answer)}.`);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Solution revealed");
  await expect(key(page, "enter")).toBeDisabled();
});

test("guesses and the row being typed survive a reload, with the clock still running", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openTermo(page, url);
  await page.clock.fastForward(4_000);
  await expect(timer(page)).toHaveText("00:04");
  await guess(page, miss);
  await page.keyboard.type("fe");

  await page.clock.fastForward("15:00");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await rowMarks(page, 0)).toEqual(scoreGuess(answer, miss));
  expect(await rowText(page, 1)).toBe("FE");
  expect(seconds((await timer(page).textContent())!)).toBeGreaterThanOrEqual(15 * 60);

  // A finished game reopens finished.
  await page.keyboard.press("Delete");
  await guess(page, answer);
  await expect(result(page)).toBeVisible();
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(status(page)).toContainText("You got it in 2 guesses");
  await expect(result(page)).toBeVisible();
});

test("a board saved before the game had two languages still opens", async ({ page }) => {
  // What the game wrote to disk then: the same snapshot, without a language. The seed is unchanged, so the puzzle id is too.
  await openTermo(page, url);
  await page.evaluate(
    async ([id, seed, word]) => {
      const open = indexedDB.open("minigames");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const transaction = db.transaction("games", "readwrite");
      const snapshot = { snapshotVersion: 1, puzzleId: id, seed, guesses: [word], draft: ["", "", "", "", ""], cursor: 0, hints: [], revealed: false, startedAt: Date.now() - 5_000, finishedMs: null };
      transaction.objectStore("games").put(snapshot, `termo:${id}`);
      await new Promise((resolve) => (transaction.oncomplete = resolve));
      db.close();
    },
    [puzzle.id, puzzle.seed, miss],
  );
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(row(page, 0)).toHaveAttribute("data-kind", "played");
  expect(await rowText(page, 0)).toBe(shown(miss));
  await expect(status(page)).toContainText("Guess 2 of 6");
});

test("leaving a game that has started asks first", async ({ page }) => {
  await openTermo(page, url);
  await page.keyboard.type("f");
  await page.getByTestId("game-home").click();
  await expect(page.getByTestId("game-leave")).toBeVisible();
  await page.getByTestId("game-leave").getByRole("button", { name: "Leave" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("hard hides two words: one guess plays on both, and a found word stops taking guesses", async ({ page }) => {
  const [first, other] = duo.puzzle.answers;
  const [wrong] = wrongWords(duo.puzzle, 1);
  await openTermo(page, duo.url);
  await expect(board(page)).toHaveAttribute("data-boards", "2");
  await expect(board(page)).toHaveAccessibleName("Termo: 2 5-letter words, 7 guesses. Every guess is played on all of them.");
  await expect(grid(page, 0).getByTestId("termo-row")).toHaveCount(7);
  await expect(grid(page, 1)).toHaveAccessibleName("Word 2 of 2");
  await expect(status(page)).toContainText("Find the 2 words in 7 guesses");

  await guess(page, wrong);
  expect(await rowMarks(page, 0, 0)).toEqual(scoreGuess(first, wrong));
  expect(await rowMarks(page, 0, 1)).toEqual(scoreGuess(other, wrong));
  // Each key is split in two, one half per board.
  await expect(key(page, wrong[0]).locator(".termo-key-parts span")).toHaveCount(2);

  await guess(page, first);
  await expect(grid(page, 0)).toHaveAttribute("data-solved", "true");
  await expect(grid(page, 0)).toHaveAccessibleName("Word 1 of 2, found");
  await expect(status(page)).toContainText(`${shown(first)} found. 1 word to go.`);
  await expect(row(page, 2, 0)).toHaveAttribute("data-kind", "empty");
  await expect(row(page, 2, 1)).toHaveAttribute("data-kind", "current");

  // A hint on two boards names the board it is about.
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText(/^In word 2, the \d(st|nd|rd|th) letter is [A-Z]\.$/);

  await guess(page, other);
  await expect(result(page)).toBeVisible();
  await expect(status(page)).toContainText("You found the 2 words in 3 guesses");
  expect(await rowText(page, 2, 0)).toBe("");
  await expect(result(page).locator(".mg-stat").nth(1)).toContainText("1");
});

test("expert hides four words and keeps the keyboard on screen", async ({ page }) => {
  await openTermo(page, quartet.url);
  await expect(board(page)).toHaveAttribute("data-boards", "4");
  await expect(board(page).getByTestId("termo-grid")).toHaveCount(4);
  await expect(grid(page, 3).getByTestId("termo-row")).toHaveCount(9);
  for (const word of wrongWords(quartet.puzzle, 4)) await guess(page, word);
  await expect(row(page, 4, 0)).toHaveAttribute("data-kind", "current");
  await expect(keyboard(page)).toBeInViewport({ ratio: 1 });
  await expect(key(page, "a").locator(".termo-key-parts span")).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("the board and the keyboard fit a 360 px phone without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openTermo(page, url);
  await expect(board(page)).toBeInViewport({ ratio: 1 });
  await expect(keyboard(page)).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("the same seed hides the same word in another browser, and accents never need typing", async ({ page, browser }) => {
  await openTermo(page, url);
  await guess(page, miss);
  const other = await (await browser.newContext()).newPage();
  await other.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: { termo: true } })));
  await other.goto(url);
  await expect(other.getByTestId("termo-board")).toHaveAttribute("data-locked", "false");
  await other.keyboard.type(miss);
  await other.keyboard.press("Enter");
  const marks = (target: typeof page) => target.locator('[data-testid="termo-row"][data-row="0"] [data-testid="termo-tile"]').evaluateAll((elements) => elements.map((element) => element.getAttribute("data-mark")));
  expect(await marks(other)).toEqual(await marks(page));
  await other.context().close();

  // A key press with an accent or a cedilla lands as its plain letter, and the played row gets the accents back.
  for (const pressed of ["á", "ç"]) await page.evaluate((value) => window.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true })), pressed);
  expect(await rowText(page, 1)).toBe("AC");
  await page.keyboard.press("Delete");
  await page.keyboard.type(second);
  await page.keyboard.press("Enter");
  expect(plainLetters(await rowText(page, 1))).toBe(second);

  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/termo.svg");
});

test("practice asks for a mode by name: Termo, Dueto or Quarteto", async ({ page }) => {
  await page.goto("/termo/practice");
  await expect(page.getByText("Board size")).toHaveCount(0);
  await expect(page.getByText("Difficulty")).toHaveCount(0);
  for (const name of ["Easy", "Medium", "Hard", "Expert"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByTestId("termo-mode-termo")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("termo-mode-summary")).toHaveText("Termo: 1 word, 6 guesses.");

  await page.getByTestId("termo-mode-quarteto").click();
  await expect(page.getByTestId("termo-mode-summary")).toHaveText("Quarteto: 4 words at once, 9 guesses.");
  await page.getByTestId("termo-mode-dueto").click();
  await expect(page.getByTestId("termo-mode-summary")).toHaveText("Dueto: 2 words at once, 7 guesses.");
  await page.getByTestId("game-seed-input").fill("modo-dueto");
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/\/en\/termo\/play\?seed=TERMO%3Amodo-dueto%3A1%3Ahard$/);
  await expect(board(page)).toHaveAttribute("data-boards", "2");
});

test("the daily is always one board, and once it is over it offers the day's Dueto and Quarteto", async ({ page }) => {
  // 10:00 in the Pacific zone on a Sunday, which is the hardest day in the other games.
  await page.clock.install({ time: new Date("2026-11-29T18:00:00Z") });
  const date = "2026-11-29";
  const daily = getTermoDailyInfo(date);
  const word = generateTermoFromSpec(daily.spec).answers[0];
  await page.goto("/termo");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(board(page)).toHaveAttribute("data-boards", "1");
  await expect(board(page).getByTestId("termo-row")).toHaveCount(6);
  // Nothing is offered while the daily is still being played.
  await expect(page.getByTestId("termo-next")).toHaveCount(0);

  await guess(page, word);
  await expect(result(page)).toBeVisible();
  // The result screen itself leads on to the day's Dueto and Quarteto. They stand in for the list of other games.
  await expect(result(page).getByTestId("termo-result-next").getByRole("link")).toHaveText(["Play the daily Dueto", "Play the daily Quarteto", "Practice"]);
  await expect(result(page).getByTestId("game-result-suggestion")).toHaveCount(0);
  await expect(result(page).getByRole("link", { name: "See the other games" })).toHaveAttribute("href", "/en");
  await result(page).getByRole("button", { name: "Close" }).click();
  await expect(keyboard(page)).toHaveCount(0);
  const next = page.getByTestId("termo-next");
  await expect(next).toHaveAccessibleName("More Termo");
  await expect(next.getByRole("link")).toHaveText(["Play the daily Dueto", "Play the daily Quarteto", "Practice"]);
  await expect(page.getByTestId("termo-next-practice")).toHaveAttribute("href", "/en/termo/practice");

  await page.getByTestId("termo-next-dueto").click();
  await expect(page).toHaveURL(new RegExp(`/en/termo/play\\?seed=TERMO%3A${date}-dueto%3A1%3Ahard$`));
  await expect(board(page)).toHaveAttribute("data-boards", "2");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  // The day's Dueto is one puzzle, like the daily: no "New game", and it is the same for everyone.
  await expect(page.getByTestId("game-new")).toHaveCount(0);
  const dueto = generateTermoFromSpec(termoDailyVariantSpec(date, "dueto"));
  await guess(page, dueto.answers[0]);
  await expect(grid(page, 0)).toHaveAttribute("data-solved", "true");
  await guess(page, dueto.answers[1]);
  await expect(result(page)).toBeVisible();
  await result(page).getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("termo-next").getByRole("link")).toHaveText(["Play the daily Termo", "Play the daily Quarteto", "Practice"]);

  await page.getByTestId("termo-next-quarteto").click();
  await expect(board(page)).toHaveAttribute("data-boards", "4");
  // Back on the daily, the finished board is still there with the same offers.
  await page.goto("/termo");
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("termo-next-dueto")).toBeVisible();
});

test("the tutorial explains the three marks before the clock starts", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: {} })));
  await page.goto(url);
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toContainText("How to play Termo");
  await expect(tutorial).toContainText("The letter F is in the word and in the right place.");
  await expect(tutorial).toContainText("The letter M is in the word, but in another position.");
  await expect(tutorial).toContainText("The letter E is not in the word.");
  // Typing while the tutorial is open does not reach the board, and the clock waits.
  await page.keyboard.type("festa");
  await expect(timer(page)).toHaveText("00:00");
  await tutorial.getByRole("button", { name: "Start playing" }).click();
  await expect(tutorial).toBeHidden();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  expect(await rowText(page, 0)).toBe("");
});
