import { expect, test } from "@playwright/test";
import { type Merge, SumbreakSolver, applyMerge, createSumbreakGame, getSumbreakHint, legalMerges } from "@/games/sumbreak/engine";
import { SETTINGS_KEY, confirmReveal, inLocale, result, seconds, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, dragMerge, openSumbreak, playMerges, sumbreakPuzzle, tapCell, tapMerge, tileAt, tiles } from "./helpers";

const SIZE = 3;
const { puzzle, url } = sumbreakPuzzle("e2e-sumbreak-1", "medium", SIZE);
const solution = puzzle.solution;

/** A legal first merge after which the board cannot be finished. Medium boards always have one, and the test says so if this one does not. */
const trap: Merge | undefined = legalMerges(SIZE, puzzle.cells).find((merge) => !new SumbreakSolver(SIZE).isSolvable(applyMerge(puzzle.cells, merge)));
/** Two neighbours with different numbers. */
const mismatch = (() => {
  for (let cell = 0; cell < SIZE * SIZE; cell++) {
    if (cell % SIZE < SIZE - 1 && puzzle.cells[cell] !== puzzle.cells[cell + 1]) return { from: cell, to: cell + 1 };
  }
  return undefined;
})();

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("the fixture has a trap and a mismatched pair", () => {
  expect(trap, "the fixture board needs a legal merge that ruins it").toBeDefined();
  expect(mismatch, "the fixture board needs two different neighbours").toBeDefined();
});

test("dragging and tapping both merge, the sum lands on the tile dropped on, and the board solves to one tile", async ({ page }) => {
  const problems = watchConsole(page);
  await openSumbreak(page, url);
  await expect(tiles(page)).toHaveCount(9);
  await expect(status(page)).toContainText(`the last tile will be ${puzzle.total}`);

  const first = solution[0];
  const value = puzzle.cells[first.from];
  await dragMerge(page, SIZE, first);
  await expect(tiles(page)).toHaveCount(8);
  await expect(tileAt(page, first.to)).toHaveAttribute("data-value", String(value * 2));
  await expect(tileAt(page, first.from)).toHaveCount(0);
  await expect(status(page)).toContainText("8 tiles left");

  // Two taps do the same: the first picks the tile up, the second drops it.
  const second = solution[1];
  await tapCell(page, SIZE, second.from);
  await expect(tileAt(page, second.from)).toHaveAttribute("data-selected", "true");
  await tapCell(page, SIZE, second.to);
  await expect(tiles(page)).toHaveCount(7);

  await playMerges(page, puzzle, solution.slice(2), 7);
  await expect(tiles(page)).toHaveCount(1);
  await expect(tiles(page).first()).toHaveAttribute("data-value", String(puzzle.total));
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Flawless");
  await expect(result(page).getByText("Missteps")).toBeVisible();
  expect(problems).toEqual([]);
});

test("a merge of different numbers changes nothing and says why", async ({ page }) => {
  await openSumbreak(page, url);
  await dragMerge(page, SIZE, mismatch!);
  await expect(tiles(page)).toHaveCount(9);
  await expect(status(page)).toContainText("Numbers must be identical");
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(board(page)).toHaveAttribute("data-shake", "true");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("a legal merge can ruin the board: a hint names it and goes back, and the misstep is counted", async ({ page }) => {
  await openSumbreak(page, url);
  await tapMerge(page, SIZE, trap!);
  await expect(tiles(page)).toHaveCount(8);
  // Nothing is said at the time. Finding out is part of the puzzle.
  await expect(status(page)).not.toHaveAttribute("data-kind", "invalid");

  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText("goes back to the last position that can still be finished");
  await expect(tiles(page)).toHaveCount(9);
  await expect(board(page)).toHaveAttribute("data-locked", "false");

  await playMerges(page, puzzle, solution);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Solved");
  const stats = result(page).locator("dl");
  await expect(stats.locator(".mg-stat").nth(0)).toContainText("1");
  await expect(stats.locator(".mg-stat").nth(1)).toContainText("1");
});

test("a hint on a healthy board plays the next merge and explains it", async ({ page }) => {
  await openSumbreak(page, url);
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText("The smallest number goes first");
  await expect(board(page).locator('[data-testid="sumbreak-tile"][data-hint]')).toHaveCount(2);
  await expect(tiles(page)).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Hint. 1 used." })).toBeVisible();
});

test("undo takes back one merge and reset clears the board", async ({ page }) => {
  await openSumbreak(page, url);
  await playMerges(page, puzzle, solution.slice(0, 3));
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(tiles(page)).toHaveCount(7);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(tiles(page)).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(status(page)).toContainText("The clock keeps running");
});

test("events that arrive faster than React renders still merge", async ({ page }) => {
  await openSumbreak(page, url);
  const grid = board(page).getByRole("grid");
  const box = (await grid.boundingBox())!;
  const step = box.width / SIZE;
  const at = (cell: number) => ({ x: box.x + ((cell % SIZE) + 0.5) * step, y: box.y + (Math.floor(cell / SIZE) + 0.5) * step });
  // Press, move and release inside one task, with no render in between.
  await board(page).evaluate(
    (element, { from, to }) => {
      const fire = (type: string, point: { x: number; y: number }) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, pointerId: 7, pointerType: "mouse", button: 0, clientX: point.x, clientY: point.y }));
      fire("pointerdown", from);
      fire("pointermove", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
      fire("pointermove", to);
      fire("pointerup", to);
    },
    { from: at(solution[0].from), to: at(solution[0].to) },
  );
  await expect(tiles(page)).toHaveCount(8);
});

test("the keyboard plays the whole game", async ({ page }) => {
  await openSumbreak(page, url);
  await board(page).getByRole("grid").focus();
  let cursor = 0;
  const moveTo = async (cell: number) => {
    const rows = Math.floor(cell / SIZE) - Math.floor(cursor / SIZE);
    const columns = (cell % SIZE) - (cursor % SIZE);
    for (let step = 0; step < Math.abs(rows); step++) await page.keyboard.press(rows > 0 ? "ArrowDown" : "ArrowUp");
    for (let step = 0; step < Math.abs(columns); step++) await page.keyboard.press(columns > 0 ? "ArrowRight" : "ArrowLeft");
    cursor = cell;
  };
  let count = 9;
  for (const merge of solution) {
    await moveTo(merge.from);
    await page.keyboard.press("Enter");
    await moveTo(merge.to);
    await page.keyboard.press("Enter");
    await expect(tiles(page)).toHaveCount(--count);
  }
  await expect(result(page)).toBeVisible();
});

test("reveal plays the solution, from the last good position if the board was ruined", async ({ page }) => {
  await openSumbreak(page, url);
  await tapMerge(page, SIZE, trap!);
  await confirmReveal(page);
  await expect(result(page)).toBeVisible({ timeout: 15_000 });
  await expect(result(page)).toContainText("Solution revealed");
  await expect(tiles(page)).toHaveCount(1);
});

test("progress survives a reload, with the clock still running", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openSumbreak(page, url);
  await page.clock.fastForward(4_000);
  await expect(timer(page)).toHaveText("00:04");
  await playMerges(page, puzzle, solution.slice(0, 3));

  await page.clock.fastForward("15:00");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(tiles(page)).toHaveCount(6);
  expect(seconds((await timer(page).textContent())!)).toBeGreaterThanOrEqual(15 * 60);
  await playMerges(page, puzzle, solution.slice(3), 6);
  await expect(result(page)).toBeVisible();
});

test("the same seed builds the same board in another browser, and practice sizes go from 3 to 5", async ({ page, browser }) => {
  await openSumbreak(page, url);
  const values = async (target: typeof page) => target.getByTestId("sumbreak-tile").evaluateAll((elements) => elements.map((element) => `${element.getAttribute("data-cell")}:${element.getAttribute("data-value")}`).sort());
  const other = await (await browser.newContext()).newPage();
  await other.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: { sumbreak: true } })));
  await other.goto(url);
  await expect(other.getByTestId("sumbreak-tile")).toHaveCount(9);
  expect(await values(other)).toEqual(await values(page));
  await other.context().close();

  await page.goto("/sumbreak/practice");
  await expect(page.getByRole("button", { name: "3 by 3" })).toBeVisible();
  await expect(page.getByRole("button", { name: "5 by 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "6 by 6" })).toHaveCount(0);
  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/sumbreak.svg");
});

test("the tutorial teaches on its own board and can be skipped", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: {} })));
  await page.goto(url);
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toContainText("Merge equal neighbours");
  // The clock waits for the tutorial.
  await expect(timer(page)).toHaveText("00:00");
  await tutorial.getByRole("button", { name: "Skip" }).click();
  await expect(tutorial).toBeHidden();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});

test.describe("in Portuguese", () => {
  const portuguese = inLocale("pt-br", url);

  test("the board, the status line, a refusal and a merge read in Portuguese", async ({ page }) => {
    const problems = watchConsole(page);
    await openSumbreak(page, portuguese);
    await expect(page).toHaveURL(/\/pt-br\/sumbreak\/play/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(status(page)).toHaveText(`Arraste um número para cima de um vizinho igual. Os dois se juntam na soma, e a última peça será ${puzzle.total}.`);
    await expect(board(page).getByRole("grid")).toHaveAccessibleName("Tabuleiro do Sumbreak, 3 por 3. As setas movem o cursor. Enter pega uma peça, e Enter em uma vizinha igual solta a peça ali.");
    await expect(board(page).getByRole("gridcell").first()).toHaveAttribute("aria-label", `Linha 1, coluna 1. ${puzzle.cells[0] === 0 ? "Vazia" : puzzle.cells[0]}.`);

    await dragMerge(page, SIZE, mismatch!);
    await expect(status(page)).toHaveText(`Os números precisam ser iguais: ${puzzle.cells[mismatch!.from]} e ${puzzle.cells[mismatch!.to]} não se juntam.`);
    await expect(status(page)).toHaveAttribute("data-kind", "invalid");

    // A tile that was picked up says so, and so does the equal neighbour that can take it.
    const first = solution[0];
    await tapCell(page, SIZE, first.from);
    await expect(board(page).locator(`#sumbreak-cell-${first.from}`)).toHaveAttribute("aria-label", /Peça na mão\.$/);
    await expect(board(page).locator(`#sumbreak-cell-${first.to}`)).toHaveAttribute("aria-label", /Pode receber a peça que você pegou\.$/);
    await tapCell(page, SIZE, first.to);
    await expect(tiles(page)).toHaveCount(8);
    await expect(status(page)).toHaveText(`Restam 8 peças. A última será ${puzzle.total}.`);

    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(status(page)).toHaveText("Última junção desfeita.");
    await playMerges(page, puzzle, solution.slice(0, 2));
    await page.getByRole("button", { name: "Reiniciar" }).click();
    await expect(status(page)).toHaveText("Tabuleiro reiniciado. O relógio continua correndo.");
    await expect(tiles(page)).toHaveCount(9);

    await playMerges(page, puzzle, solution);
    await expect(board(page)).toHaveAttribute("data-solved", "true");
    await expect(status(page)).toHaveText("Resolvido. Sobrou uma peça só.");
    await expect(result(page).getByText("Tropeços")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a hint explains the next merge and a dead end in Portuguese", async ({ page }) => {
    await openSumbreak(page, portuguese);
    const hint = getSumbreakHint(puzzle, createSumbreakGame(puzzle.id, puzzle));
    if (hint.kind !== "merge") throw new Error("the fixture board needs a first merge");
    const direction = { right: "à direita dele", left: "à esquerda dele", below: "abaixo dele", above: "acima dele" }[hint.direction];

    await page.getByRole("button", { name: /^Dica/ }).click();
    await expect(status(page)).toHaveAttribute("data-kind", "hint");
    await expect(status(page)).toContainText(`O menor número vai primeiro. Solte o ${hint.value} da linha ${hint.row}, coluna ${hint.column}, sobre o ${hint.value} ${direction}: `);
    await expect(status(page)).toContainText(hint.total === 1 ? "é o único par deles." : "tabuleiro que ainda pode ser terminado");
    await expect(tiles(page)).toHaveCount(8);
    await expect(page.getByRole("button", { name: "Dica. 1 usada." })).toBeVisible();

    // Back to the start, then into the trap: the hint names the dead end and takes the board back.
    await page.getByRole("button", { name: "Reiniciar" }).click();
    await expect(tiles(page)).toHaveCount(9);
    await tapMerge(page, SIZE, trap!);
    await expect(tiles(page)).toHaveCount(8);
    await page.getByRole("button", { name: /^Dica/ }).click();
    await expect(status(page)).toContainText("O tabuleiro volta para a última posição que ainda pode ser terminada.");
    await expect(tiles(page)).toHaveCount(9);

    await page.getByRole("button", { name: "Revelar" }).click();
    await page.getByTestId("game-confirm").getByRole("button", { name: "Revelar" }).click();
    await expect(status(page)).toHaveText(/Revelando a solução\.|Solução revelada\./);
    await expect(tiles(page)).toHaveCount(1, { timeout: 15_000 });
    await expect(status(page)).toHaveText("Solução revelada.");
  });

  test("the tutorial teaches in Portuguese", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ sound: false, haptics: false, tutorials: {} })), SETTINGS_KEY);
    await page.goto(portuguese);
    const tutorial = page.getByTestId("game-tutorial");
    await expect(tutorial).toContainText("Como jogar Sumbreak");
    await expect(tutorial).toContainText("1. Junte vizinhos iguais");
    await expect(tutorial).toContainText("Comece pelos dois 1.");
    await expect(tutorial.getByRole("grid")).toHaveAccessibleName("Tabuleiro do tutorial, 3 por 3");
    await expect(tutorial.getByRole("button", { name: "Desfazer" })).toBeDisabled();

    // The hint plays the one safe merge of the two 1s and says why, which moves the lesson on.
    await tutorial.getByRole("button", { name: /^Dica/ }).click();
    await expect(tutorial).toContainText("O menor número vai primeiro. Solte o 1 da linha 1, coluna 2, sobre o 1 à esquerda dele: das 2 maneiras de juntar os 1, é a única que deixa um tabuleiro que ainda pode ser terminado.");
    await expect(tutorial.getByTestId("sumbreak-tile")).toHaveCount(6);
    await expect(tutorial).toContainText("2. A ordem é o desafio");

    await tutorial.getByRole("button", { name: "Pular" }).click();
    await expect(tutorial).toBeHidden();
    await expect(board(page)).toHaveAttribute("data-locked", "false");
    await expect(status(page)).toContainText("Arraste um número para cima de um vizinho igual.");
  });
});
