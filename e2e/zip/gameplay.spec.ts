import { expect, test } from "@playwright/test";
import { buildTopology } from "@/games/zip/engine";
import { confirmReveal, result, seconds, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, dragCells, drawCells, openZip, refusedNeighbor, tapCell, visited, zipPuzzle } from "./helpers";

const SIZE = 6;
// This seed was picked because its board has all three situations the tests below need: a wall next to
// the solution path, a legal detour right after 2, and a last number that can be reached too early.
// The tests assert that, so a generator change that breaks the assumption fails loudly and never skips.
const { puzzle, url } = zipPuzzle("e2e-zip-1", "medium", SIZE);
const solution = puzzle.solution;
const topology = buildTopology(puzzle);

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("drag draws the path, dragging back rewinds it, a tap cuts it, undo and reset work", async ({ page }) => {
  const problems = watchConsole(page);
  await openZip(page, url);

  await drawCells(page, SIZE, solution.slice(0, 8));
  await expect(visited(page)).toHaveCount(8);
  await expect(board(page).getByTestId("zip-segment")).toHaveCount(7);
  await expect(status(page)).toContainText("8 of 36 cells");

  // Drag backwards along the path: it rewinds cell by cell.
  await drawCells(page, SIZE, [solution[7], solution[6], solution[5]]);
  await expect(visited(page)).toHaveCount(6);

  // A tap far back on the path cuts it there.
  await tapCell(page, SIZE, solution[2]);
  await expect(visited(page)).toHaveCount(3);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(visited(page)).toHaveCount(6);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(visited(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(problems).toEqual([]);
});

test("the path must start on 1, and a refused step shakes the board without changing the path", async ({ page }) => {
  await openZip(page, url);
  const notOne = solution[10];
  await tapCell(page, SIZE, notOne);
  await expect(visited(page)).toHaveCount(0);
  await expect(status(page)).toContainText("starts on 1");
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(board(page)).toHaveAttribute("data-shake", "true");
  await expect(board(page).locator('.zip-cell[data-refused="true"]')).toHaveCount(1);

  // Crossing the path itself is refused too.
  await drawCells(page, SIZE, solution.slice(0, 5));
  const head = solution[4];
  const crossing = topology.neighbors[head].find((cell) => solution.slice(0, 3).includes(cell));
  if (crossing !== undefined) {
    await dragCells(page, SIZE, [head, crossing]);
    await page.mouse.up();
    await expect(visited(page)).toHaveCount(5);
  }
});

test("a wall stops the path", async ({ page }) => {
  let prefix = 0;
  let blocked: ReturnType<typeof refusedNeighbor> = null;
  for (let length = 1; length < solution.length - 1 && !blocked; length++) {
    blocked = refusedNeighbor(puzzle, length);
    prefix = length;
  }
  expect(blocked, "the fixture board needs a wall next to the solution path").not.toBeNull();
  await openZip(page, url);
  await drawCells(page, SIZE, solution.slice(0, prefix));
  await dragCells(page, SIZE, [solution[prefix - 1], blocked!.cell]);
  await page.mouse.up();
  await expect(visited(page)).toHaveCount(prefix);
  await expect(status(page)).toContainText(blocked!.reason);
});

test("a fast drag that skips cells still fills the straight line between them", async ({ page }) => {
  await openZip(page, url);
  // Find the longest straight run in the solution and jump from its start to its end in one move.
  let best = { from: 0, to: 1 };
  for (let start = 0; start < solution.length - 1; start++) {
    const stride = solution[start + 1] - solution[start];
    let end = start + 1;
    while (end + 1 < solution.length && solution[end + 1] - solution[end] === stride && topology.numberAt[solution[end]] === 0) end++;
    if (end - start > best.to - best.from) best = { from: start, to: end };
  }
  expect(best.to - best.from).toBeGreaterThanOrEqual(2);
  await drawCells(page, SIZE, solution.slice(0, best.from + 1));
  await drawCells(page, SIZE, [solution[best.from], solution[best.to]]);
  await expect(visited(page)).toHaveCount(best.to + 1);
});

test("events that arrive faster than React renders still build the whole path", async ({ page }) => {
  await openZip(page, url);
  await page.evaluate(
    ({ cells, size }) => {
      const element = document.querySelector<HTMLElement>('[data-testid="zip-board"]')!;
      const box = element.querySelector('[role="grid"]')!.getBoundingClientRect();
      const step = box.width / size;
      const send = (type: string, cell: number) =>
        element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, clientX: box.left + ((cell % size) + 0.5) * step, clientY: box.top + (Math.floor(cell / size) + 0.5) * step }));
      send("pointerdown", cells[0]);
      for (const cell of cells.slice(1)) send("pointermove", cell);
      send("pointerup", cells[cells.length - 1]);
    },
    { cells: solution.slice(0, 12), size: SIZE },
  );
  await expect(visited(page)).toHaveCount(12);
});

test("a hint draws the way to the next number, and cuts a wrong turn first", async ({ page }) => {
  await openZip(page, url);
  await page.getByRole("button", { name: /^Hint/ }).click();
  const toTwo = solution.findIndex((cell) => topology.numberAt[cell] === 2) + 1;
  await expect(visited(page)).toHaveCount(toTwo, { timeout: 10_000 });
  await expect(status(page)).toHaveAttribute("data-kind", "hint");
  await expect(page.getByRole("button", { name: /^Hint/ })).toContainText("1");

  // Leave the solution on purpose, if the board allows a legal detour here.
  const head = solution[toTwo - 1];
  const detour = topology.neighbors[head].find((cell) => cell !== solution[toTwo] && !solution.slice(0, toTwo).includes(cell) && topology.numberAt[cell] === 0);
  expect(detour, "the fixture board needs a legal detour after 2").toBeDefined();
  await drawCells(page, SIZE, [head, detour!]);
  await expect(visited(page)).toHaveCount(toTwo + 1);
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(board(page).locator('.zip-cell[data-wrong="true"]')).toHaveCount(1);
  await expect(visited(page)).toHaveCount(toTwo);
  await expect(status(page)).toContainText("goes wrong");
});

test("reaching the last number too early is explained, not accepted", async ({ page }) => {
  const last = solution[solution.length - 1];
  // Walk the solution until the head is next to the last number with cells still empty.
  let prefix = -1;
  for (let length = 2; length < solution.length - 2; length++) {
    const head = solution[length - 1];
    const next = topology.numberAt[last];
    const expected = Math.max(...solution.slice(0, length).map((cell) => topology.numberAt[cell])) + 1;
    if (topology.neighbors[head].includes(last) && expected === next) prefix = length;
  }
  expect(prefix, "the fixture board needs a last number that can be reached early").toBeGreaterThan(0);
  await openZip(page, url);
  await drawCells(page, SIZE, solution.slice(0, prefix));
  await drawCells(page, SIZE, [solution[prefix - 1], last]);
  await expect(status(page)).toContainText("still empty");
  await expect(board(page)).toHaveAttribute("data-solved", "false");
  await expect(board(page).locator('.zip-cell[data-missing="true"]')).toHaveCount(solution.length - prefix - 1);
});

test("solving shows the result, locks the board and offers the next puzzle", async ({ page }) => {
  await openZip(page, url);
  await drawCells(page, SIZE, solution);
  await expect(board(page)).toHaveAttribute("data-solved", "true");
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Flawless");
  await expect(result(page)).toContainText("Backtracks");
  await expect(result(page).getByRole("link", { name: /Play today's Patches/ })).toBeVisible();

  // The solved board keeps only the answer: walls and numbers fade out and the line gets thicker.
  await expect(board(page).locator(".zip-number").first()).toHaveCSS("opacity", "0");
  if (puzzle.walls.length > 0) await expect(board(page).getByTestId("zip-wall").first()).toHaveCSS("opacity", "0");
  await expect.poll(async () => Number.parseFloat(await board(page).getByTestId("zip-segment").first().evaluate((line) => getComputedStyle(line).strokeWidth))).toBeGreaterThan(0.4);

  await result(page).getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/seed=ZIP%3A[a-z0-9]{8}%3A2%3Amedium%3A6/);
  await expect(visited(page)).toHaveCount(0);
});

test("revealing draws the solution cell by cell and earns nothing", async ({ page }) => {
  await openZip(page, url);
  await drawCells(page, SIZE, solution.slice(0, 4));
  await confirmReveal(page);
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(visited(page)).toHaveCount(solution.length, { timeout: 15_000 });
  await expect(result(page)).toContainText("Solution revealed");
  await expect(result(page).getByRole("button", { name: /Share/ })).toHaveCount(0);
});

test("the keyboard alone can draw and take back the path", async ({ page }) => {
  await openZip(page, url);
  await board(page).getByRole("grid").focus();
  const key = (from: number, to: number) => (to === from + 1 ? "ArrowRight" : to === from - 1 ? "ArrowLeft" : to > from ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("ArrowRight"); // the first key puts the path on 1
  await expect(visited(page)).toHaveCount(1);
  for (let step = 1; step < 6; step++) await page.keyboard.press(key(solution[step - 1], solution[step]));
  await expect(visited(page)).toHaveCount(6);
  await page.keyboard.press("Backspace");
  await expect(visited(page)).toHaveCount(5);
  await page.keyboard.press("z");
  await expect(visited(page)).toHaveCount(6);
});

test("the clock starts on first sight, survives a reload and keeps counting while away", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-21T18:00:00Z") });
  await openZip(page, url);
  await page.clock.fastForward(4_000);
  await expect(timer(page)).toHaveText("00:04");
  await drawCells(page, SIZE, solution.slice(0, 7));

  await page.clock.fastForward("15:00");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(visited(page)).toHaveCount(7);
  expect(seconds(await timer(page).innerText())).toBeGreaterThanOrEqual(904);
});

test("a shared URL rebuilds the same board", async ({ page, browser }) => {
  await openZip(page, url);
  const labels = await page.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  expect(labels.filter((label) => label?.includes("Number"))).toHaveLength(puzzle.checkpoints.length);
  await expect(board(page).getByTestId("zip-wall")).toHaveCount(puzzle.walls.length);

  const other = await (await browser.newContext()).newPage();
  await skipTutorials(other);
  await openZip(other, url);
  expect(await other.getByRole("gridcell").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")))).toEqual(labels);
});

test("the board sits on whole pixels", async ({ page }) => {
  await openZip(page, url);
  const grid = (await board(page).getByRole("grid").boundingBox())!;
  expect(grid.width % SIZE).toBe(0);
  expect(grid.width).toBe(grid.height);
  expect(Number.isInteger(grid.x)).toBe(true);
});

test("practice has a New game control that loads another board and restarts the clock", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-21T18:00:00Z") });
  await openZip(page, url);
  await drawCells(page, SIZE, solution.slice(0, 6));
  // Real time spent dragging counts too, so the clock shows at least the twenty seconds skipped here.
  await page.clock.fastForward(20_000);
  expect(seconds(await timer(page).innerText())).toBeGreaterThanOrEqual(20);

  await page.getByTestId("game-new").click();
  await expect(page).toHaveURL(/seed=ZIP%3A[a-z0-9]{8}%3A2%3Amedium%3A6/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(visited(page)).toHaveCount(0);
  expect(seconds(await timer(page).innerText())).toBeLessThan(3);
});

test("the daily puzzle has no New game control", async ({ page }) => {
  await openZip(page, "/zip");
  await expect(page.getByTestId("game-new")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
});

test("expert boards hide some numbers behind a ?, and a covered ? shows the place it takes on the path", async ({ page }) => {
  const hiddenBoard = zipPuzzle("e2e-zip-hidden", "expert", 7);
  const hidden = hiddenBoard.puzzle.checkpoints.filter((checkpoint) => checkpoint.hidden);
  expect(hidden.length).toBeGreaterThan(0);
  expect(hidden.length).toBeLessThan(hiddenBoard.puzzle.checkpoints.length - 2);

  await openZip(page, hiddenBoard.url);
  const marks = board(page).getByTestId("zip-hidden-number");
  await expect(marks).toHaveCount(hidden.length);
  for (const text of await marks.allTextContents()) expect(text).toBe("?");
  await expect(status(page)).toContainText("A ? is a number too");

  // Draw the solution up to the first hidden number: it now shows its place, which is its real number on the right path.
  const first = hidden[0];
  const reach = hiddenBoard.puzzle.solution.indexOf(first.row * 7 + first.column);
  await drawCells(page, 7, hiddenBoard.puzzle.solution.slice(0, reach + 1));
  await expect(marks.filter({ hasText: String(first.number) })).toHaveCount(1);
  await expect(marks.filter({ hasText: "?" })).toHaveCount(hidden.length - 1);
});
