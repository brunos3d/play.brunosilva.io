import { expect, test } from "@playwright/test";
import { getHint } from "@/games/patches/engine";
import { inLocale } from "../shared";
import { board, cellCenter, dragThrough, draw, firstStroke, openPuzzle, overshoot, practicePuzzle, regions, skipTutorial, status, tapCell, watchConsole } from "./helpers";

const SIZE = 6;
const { puzzle, targets, url } = practicePuzzle("e2e-pt", "medium", SIZE);
/** The same puzzle with the interface in Portuguese. */
const portuguese = inLocale("pt-br", url);

test.describe("at /pt-br, past the tutorial", () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page);
    await openPuzzle(page, portuguese);
  });

  test("the status line, a refusal and the board's labels are in Portuguese", async ({ page }) => {
    const problems = watchConsole(page);
    await expect(page).toHaveURL(/\/pt-br\/patches\/play\?seed=/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(status(page)).toHaveText("Pressione uma pista e arraste a partir dela para desenhar o retalho.");
    await expect(board(page).getByRole("grid")).toHaveAccessibleName(new RegExp(`^Tabuleiro do Patches, ${SIZE} por ${SIZE}, ${puzzle.clues.length} pistas\\. As setas movem o cursor\\.`));

    // One row or column too many for a numbered clue is refused, and the reason is in Portuguese.
    await draw(page, SIZE, overshoot(puzzle));
    await expect(status(page)).toHaveAttribute("data-kind", "invalid");
    await expect(status(page)).toHaveText(/^Esta pista pede \d+ casas?\. O retalho tem \d+\.$/);
    await expect(regions(page)).toHaveCount(0);

    const { rect, clue } = targets[0];
    await draw(page, SIZE, targets[0]);
    await expect(status(page)).toHaveText(`Retalho de ${rect.width} por ${rect.height} colocado.`);
    const clueCell = page.getByRole("gridcell").nth(clue.row * SIZE + clue.column);
    await expect(clueCell).toHaveAttribute("aria-label", new RegExp(`^Linha ${clue.row + 1}, coluna ${clue.column + 1}\\. Pista: .+\\. Dentro de um retalho de ${rect.width} por ${rect.height}\\.$`));
    const labels = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label") ?? ""));
    expect(labels.filter((label) => label.includes("Pista:"))).toHaveLength(puzzle.clues.length);
    expect(labels.filter((label) => label.endsWith("Vazia."))).toHaveLength(SIZE * SIZE - rect.width * rect.height);
    expect(labels.join(" ")).not.toMatch(/Row|Clue|Empty|patch/);

    await tapCell(page, SIZE, { row: rect.row, column: rect.column });
    await expect(status(page)).toHaveText("Retalho removido.");
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(status(page)).toHaveText("Última jogada desfeita.");
    await expect(regions(page)).toHaveCount(1);

    // A drag from a cell without a clue gets the nudge.
    const empty = Array.from({ length: SIZE * SIZE }, (_, index) => ({ row: Math.floor(index / SIZE), column: index % SIZE })).find(
      (cell) => !puzzle.clues.some((entry) => entry.row === cell.row && entry.column === cell.column) && !(cell.row >= rect.row && cell.row < rect.row + rect.height && cell.column >= rect.column && cell.column < rect.column + rect.width),
    )!;
    const neighbour = { row: empty.row, column: empty.column === SIZE - 1 ? empty.column - 1 : empty.column + 1 };
    await dragThrough(page, SIZE, [empty, neighbour]);
    await page.mouse.up();
    await expect(status(page)).toHaveText("Comece em uma pista: pressione uma casa com um número ou uma forma e arraste para fora.");

    await page.getByRole("button", { name: "Reiniciar" }).click();
    await expect(status(page)).toHaveText("Tabuleiro limpo. O relógio continua correndo.");
    expect(problems).toEqual([]);
  });

  test("a hint explains itself in Portuguese, and the progress line counts unfinished patches", async ({ page }) => {
    // The first hint on this board: the only rectangle left for a clue of 3 cells that takes any rectangle.
    const hint = getHint(puzzle, []);
    if (hint.kind !== "place-region") throw new Error("the empty board has a hint");
    expect(hint).toMatchObject({ technique: "clue-single", neededElimination: false, clue: { area: 3, shape: "freeform" } });
    await page.getByRole("button", { name: /^Dica/ }).click();
    await expect(status(page)).toHaveAttribute("data-kind", "hint");
    await expect(status(page)).toHaveText(`Só um retângulo serve para esta pista (3 casas, qualquer retângulo) no espaço que sobrou. Desenhe o retalho de ${hint.rect.width} por ${hint.rect.height}.`);
    await expect(regions(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Dica/ })).toContainText("1");

    // Two cells of a numbered clue: the patch stays as unfinished, and the line says how far it is.
    const stroke = firstStroke({ ...puzzle, solution: puzzle.solution.filter((region) => region.clueId !== hint.clueId) });
    await draw(page, SIZE, { clue: stroke.target.clue, rect: stroke.part });
    await expect(status(page)).toHaveText(`2 de ${stroke.area} casas. Arraste de novo a partir da pista ou do retalho para completar.`);

    // The line under the board goes back to the count after a reload, and the board is still there.
    await page.reload();
    await expect(board(page)).toHaveAttribute("data-locked", "false");
    await expect(regions(page)).toHaveCount(2);
    await expect(status(page)).toHaveText(`1 de ${puzzle.clues.length} retalhos prontos, 1 incompleto.`);
  });

  test("the game and its tutorial fit a 360 px screen in Portuguese", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.getByRole("button", { name: /^Dica/ }).click();
    await expect(status(page)).toHaveAttribute("data-kind", "hint");
    expect(await sideways()).toBe(0);

    await page.getByRole("button", { name: "Como jogar" }).click();
    const tutorial = page.getByTestId("game-tutorial");
    await expect(tutorial).toBeVisible();
    // Every label sits inside its button. "Desfazer" is the long one.
    const buttons = tutorial.locator(".mg-button");
    await expect(buttons).toHaveCount(3);
    for (const button of await buttons.all()) {
      expect(await button.evaluate((element) => element.scrollWidth - element.clientWidth), await button.innerText()).toBe(0);
    }
    expect(await sideways()).toBe(0);
  });
});

// No skipTutorial here: a first visit, with empty storage, on a Portuguese page.
test("the first visit at /pt-br opens the tutorial in Portuguese, and it can be completed", async ({ page }) => {
  await page.goto(portuguese);

  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByRole("heading", { name: "Como jogar Patches" })).toBeVisible();
  await expect(tutorial).toContainText("1. Desenhe um retalho");
  await expect(tutorial).toContainText("Cada retalho é um retângulo com exatamente uma pista dentro.");
  for (const name of ["Desfazer", "Dica", "Pular"]) await expect(tutorial.getByRole("button", { name })).toBeVisible();
  const mini = tutorial.getByRole("grid");
  await expect(mini).toHaveAccessibleName("Tabuleiro do tutorial, 4 por 4");

  const drag = async (...cells: [number, number][]) => {
    await dragThrough(page, 4, cells.map(([row, column]) => ({ row, column })), mini);
    await page.mouse.up();
  };

  // A drag from a cell without a clue: the tutorial says where to start.
  await drag([0, 2], [0, 1]);
  await expect(tutorial).toContainText("Comece em uma pista: pressione uma casa com um número ou uma forma e arraste para fora.");
  await expect(tutorial).toContainText("1. Desenhe um retalho");

  // The hint draws the first patch and explains it, in Portuguese.
  await tutorial.getByRole("button", { name: "Dica" }).click();
  await expect(tutorial).toContainText("Só um retângulo serve para esta pista (um quadrado de 4 casas) no espaço que sobrou. Desenhe o retalho de 2 por 2.");

  await expect(tutorial).toContainText("2. Formas");
  await drag([1, 3], [0, 2], [2, 2]);
  await expect(tutorial).toContainText("3. Remova um retalho");
  const tap = await cellCenter(mini, 4, { row: 0, column: 3 });
  await page.mouse.click(tap.x, tap.y);
  await expect(tutorial).toContainText("4. Desfazer");
  await tutorial.getByRole("button", { name: "Desfazer" }).click();
  await expect(tutorial).toContainText("5. Sem número");
  await drag([2, 0], [2, 1]);
  await expect(tutorial).toContainText("6. Preencha o tabuleiro");
  await drag([3, 2], [3, 0], [3, 3]);
  await expect(tutorial).toContainText("O jogo é só isso");
  await expect(tutorial).toContainText("Uma pista por retalho, sem sobreposição nem casa vazia.");
  await tutorial.getByRole("button", { name: "Começar a jogar" }).click();
  await expect(tutorial).toBeHidden();

  // The game behind it is in Portuguese too.
  await expect(board(page)).toBeVisible();
  await expect(status(page)).toHaveText("Pressione uma pista e arraste a partir dela para desenhar o retalho.");
});
