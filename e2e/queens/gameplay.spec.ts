import { expect, test } from "@playwright/test";
import { buildTopology, ruledOutCells } from "@/games/queens/engine";
import { confirmReveal, result, seconds, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, crosses, dragCells, openQueens, placeQueen, queens, queensPuzzle, ruledOut, solve, tapCell } from "./helpers";

const SIZE = 6;
const { puzzle, url } = queensPuzzle("e2e-queens-1", "medium", SIZE);
const solution = puzzle.solution;
const topology = buildTopology(puzzle);
const first = solution[0];
/** A cell in the same row as the first queen. */
const sameRow = first % SIZE === 0 ? first + 1 : first - 1;
/** Cells of the bottom row that hold no queen in the solution. */
const spare = Array.from({ length: SIZE }, (_, column) => (SIZE - 1) * SIZE + column).filter((cell) => !solution.includes(cell));
/** Three of them side by side, so a drag across them crosses nothing else. The bottom row has one queen, which leaves a run of three on one side. */
const run = spare.filter((cell, index) => spare[index + 2] === cell + 2 || spare[index - 2] === cell - 2 || (spare[index - 1] === cell - 1 && spare[index + 1] === cell + 1)).slice(0, 3);

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("a tap cycles a cell through X, queen and empty, and undo and reset work", async ({ page }) => {
  const problems = watchConsole(page);
  await openQueens(page, url);
  await expect(status(page)).toContainText("Tap a cell once for an X");

  await tapCell(page, SIZE, first);
  await expect(crosses(page)).toHaveCount(1);
  await tapCell(page, SIZE, first);
  await expect(queens(page)).toHaveCount(1);
  await expect(crosses(page)).toHaveCount(0);
  await expect(status(page)).toContainText(`1 of ${SIZE} queens placed`);
  await tapCell(page, SIZE, first);
  await expect(queens(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(queens(page)).toHaveCount(1);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(queens(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(problems).toEqual([]);
});

test("a queen shows what it rules out, and a queen that breaks a rule is refused", async ({ page }) => {
  await openQueens(page, url);
  await placeQueen(page, SIZE, first);
  await expect(ruledOut(page)).toHaveCount(ruledOutCells(topology, [first]).size);

  await placeQueen(page, SIZE, sameRow);
  await expect(queens(page)).toHaveCount(1);
  await expect(crosses(page)).toHaveCount(1);
  await expect(status(page)).toContainText("row already has a queen");
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(board(page)).toHaveAttribute("data-shake", "true");
  await expect(board(page).locator('.queens-cell[data-refused="true"]')).toHaveCount(1);
  await expect(board(page).locator('.queens-cell[data-conflict="true"]')).toHaveCount(1);

  // The tap after a refusal clears the X, so the cell is never stuck.
  await tapCell(page, SIZE, sameRow);
  await expect(crosses(page)).toHaveCount(0);
  await expect(queens(page)).toHaveCount(1);
});

test("a drag marks every cell it crosses as one move, and a drag from an X erases", async ({ page }) => {
  await openQueens(page, url);
  expect(run).toEqual([run[0], run[0] + 1, run[0] + 2]);
  await dragCells(page, SIZE, run);
  await expect(crosses(page)).toHaveCount(3);
  await dragCells(page, SIZE, run.slice(0, 2));
  await expect(crosses(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(crosses(page)).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(crosses(page)).toHaveCount(0);
});

test("events that arrive faster than React renders still mark the whole drag", async ({ page }) => {
  await openQueens(page, url);
  await page.evaluate(
    ({ cells, size }) => {
      const element = document.querySelector<HTMLElement>('[data-testid="queens-board"]')!;
      const box = element.querySelector('[role="grid"]')!.getBoundingClientRect();
      const step = box.width / size;
      const send = (type: string, cell: number) =>
        element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, clientX: box.left + ((cell % size) + 0.5) * step, clientY: box.top + (Math.floor(cell / size) + 0.5) * step }));
      send("pointerdown", cells[0]);
      for (const cell of cells.slice(1)) send("pointermove", cell);
      send("pointerup", cells[cells.length - 1]);
    },
    { cells: spare, size: SIZE },
  );
  await expect(crosses(page)).toHaveCount(spare.length);
});

test("a hint plays the next deduction and says why, and takes a wrong queen off first", async ({ page }) => {
  await openQueens(page, url);
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(status(page)).toHaveAttribute("data-kind", "hint");
  await expect(page.getByRole("button", { name: /^Hint/ })).toContainText("1");
  await expect.poll(async () => (await queens(page).count()) + (await crosses(page).count())).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Reset" }).click();
  const wrong = Array.from({ length: SIZE * SIZE }, (_, cell) => cell).find((cell) => !solution.includes(cell))!;
  await placeQueen(page, SIZE, wrong);
  await expect(queens(page)).toHaveCount(1);
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(board(page).locator('.queens-cell[data-wrong="true"]')).toHaveCount(1);
  await expect(status(page)).toContainText("wrong place");
  await expect(queens(page)).toHaveCount(0);
});

test("hints alone finish the board", async ({ page }) => {
  await openQueens(page, url);
  for (let step = 0; step < puzzle.metadata.steps; step++) {
    await expect(board(page)).toHaveAttribute("data-solved", "false");
    const marked = (await queens(page).count()) + (await crosses(page).count());
    await page.getByRole("button", { name: /^Hint/ }).click();
    await expect.poll(async () => (await queens(page).count()) + (await crosses(page).count())).toBeGreaterThan(marked);
  }
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(queens(page)).toHaveCount(SIZE);
  await expect(result(page)).toContainText("Solved");
});

test("solving shows the result, locks the board and offers the next puzzle", async ({ page }) => {
  await openQueens(page, url);
  await solve(page, puzzle);
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Flawless");
  await expect(result(page)).toContainText("Hints");
  await expect(result(page).getByRole("link", { name: /Play today's Zip/ })).toBeVisible();

  await result(page).getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/seed=QUEENS%3A[a-z0-9]{8}%3A1%3Amedium%3A6/);
  await expect(queens(page)).toHaveCount(0);
});

test("revealing places the queens one by one and earns nothing", async ({ page }) => {
  await openQueens(page, url);
  await placeQueen(page, SIZE, first);
  await confirmReveal(page);
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(queens(page)).toHaveCount(SIZE, { timeout: 15_000 });
  await expect(result(page)).toContainText("Solution revealed");
  await expect(result(page).getByRole("button", { name: /Share/ })).toHaveCount(0);
});

test("the keyboard alone can place and remove a queen", async ({ page }) => {
  await openQueens(page, url);
  await board(page).getByRole("grid").focus();
  for (let column = 0; column < first % SIZE; column++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(crosses(page)).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(queens(page)).toHaveCount(1);
  await expect(board(page).locator('.queens-cell[data-cursor="true"]')).toHaveAttribute("aria-label", /Queen\./);
  await page.keyboard.press("Delete");
  await expect(queens(page)).toHaveCount(0);
  await page.keyboard.press("z");
  await expect(queens(page)).toHaveCount(1);
});

test("the clock starts on first sight, survives a reload and keeps counting while away", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openQueens(page, url);
  await page.clock.fastForward(4_000);
  await expect(timer(page)).toHaveText("00:04");
  await placeQueen(page, SIZE, first);
  await dragCells(page, SIZE, run);

  await page.clock.fastForward("15:00");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(queens(page)).toHaveCount(1);
  await expect(crosses(page)).toHaveCount(3);
  expect(seconds(await timer(page).innerText())).toBeGreaterThanOrEqual(904);
});

test("a shared URL rebuilds the same board", async ({ page, browser }) => {
  await openQueens(page, url);
  const regions = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-region")));
  expect(regions.map(Number)).toEqual(puzzle.regions);
  const labels = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));

  const other = await (await browser.newContext()).newPage();
  await skipTutorials(other);
  await openQueens(other, url);
  expect(await other.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(labels);
});

test("the board sits on whole pixels", async ({ page }) => {
  await openQueens(page, url);
  const grid = (await board(page).getByRole("grid").boundingBox())!;
  expect(grid.width % SIZE).toBe(0);
  expect(grid.width).toBe(grid.height);
  expect(Number.isInteger(grid.x)).toBe(true);
});

test("practice has a New game control that loads another board and restarts the clock", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openQueens(page, url);
  await placeQueen(page, SIZE, first);
  await page.clock.fastForward(20_000);
  expect(seconds(await timer(page).innerText())).toBeGreaterThanOrEqual(20);

  await page.getByTestId("game-new").click();
  await expect(page).toHaveURL(/seed=QUEENS%3A[a-z0-9]{8}%3A1%3Amedium%3A6/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(queens(page)).toHaveCount(0);
  expect(seconds(await timer(page).innerText())).toBeLessThan(3);
});

test("the daily puzzle has no New game control, and practice offers every size", async ({ page }) => {
  await openQueens(page, "/queens");
  await expect(page.getByTestId("game-new")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();

  await page.goto("/queens/practice");
  await expect(page.getByRole("button", { name: "5 by 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "10 by 10" })).toBeVisible();
  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/queens.svg");
});

test("the tutorial teaches on its own board and can be skipped", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: {} })));
  await page.goto(url);
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toContainText("How to play Queens");
  await expect(tutorial.getByTestId("queens-board")).toBeVisible();
  await expect(tutorial).toContainText("1. Mark a cell");
  await tutorial.getByRole("button", { name: /^Hint/ }).click();
  await expect(tutorial.locator('.queens-cell[data-mark="queen"]')).toHaveCount(1);
  await tutorial.getByRole("button", { name: "Skip" }).click();
  await expect(tutorial).toBeHidden();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});
