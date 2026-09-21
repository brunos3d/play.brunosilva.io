import { expect, test } from "@playwright/test";
import { type Puzzle, type Rect, clueAccepts, generateFromSpec, rectContains, rectEquals, resolveSpec } from "@/games/patches/engine";
import { type Target, board, cellCenter, dragThrough, draw, openPuzzle, regions, skipTutorial, status, tapCell, targetsOf } from "./helpers";

const SIZE = 7;

/** First seed whose puzzle has a patch with the clue strictly inside it on one axis: the case a corner drag cannot draw. */
function puzzleWithInteriorClue(): { puzzle: Puzzle; targets: Target[]; interior: Target; url: string } {
  for (let i = 0; i < 200; i++) {
    const puzzle = generateFromSpec(resolveSpec({ seed: `e2e-drag-${i}`, difficulty: "medium", size: SIZE }));
    const targets = targetsOf(puzzle);
    const interior = targets.find(({ rect, clue }) => clue.row > rect.row && clue.row < rect.row + rect.height - 1);
    if (interior) return { puzzle, targets, interior, url: `/patches/play?seed=${encodeURIComponent(puzzle.seed)}` };
  }
  throw new Error("no seed with an interior clue");
}

const { puzzle, targets, interior, url } = puzzleWithInteriorClue();

/** A legal patch for some clue that is not the one in the solution, touching no other clue. */
function legalButWrong(): Target {
  for (const target of targets) {
    const clue = puzzle.clues.find((entry) => entry.row === target.clue.row && entry.column === target.clue.column)!;
    for (let height = 1; height <= 3; height++) {
      for (let width = 1; width <= 3; width++) {
        if (width * height === 1) continue;
        for (let row = Math.max(0, clue.row - height + 1); row <= clue.row && row + height <= SIZE; row++) {
          for (let column = Math.max(0, clue.column - width + 1); column <= clue.column && column + width <= SIZE; column++) {
            const rect: Rect = { row, column, width, height };
            const onlyThisClue = puzzle.clues.filter((entry) => rectContains(rect, entry)).length === 1;
            if (onlyThisClue && clueAccepts(clue, width, height) && !rectEquals(rect, target.rect)) return { rect, clue: target.clue };
          }
        }
      }
    }
  }
  throw new Error("no legal-but-wrong patch in this puzzle");
}

test.beforeEach(async ({ page }) => {
  await skipTutorial(page);
  await openPuzzle(page, url);
});

test("a drag that starts on an empty cell draws nothing and says where to start", async ({ page }) => {
  const empty = Array.from({ length: SIZE * SIZE }, (_, i) => ({ row: Math.floor(i / SIZE), column: i % SIZE })).find(
    (cell) => !puzzle.clues.some((clue) => clue.row === cell.row && clue.column === cell.column),
  )!;
  await dragThrough(page, SIZE, [empty, targets[0].clue, { row: SIZE - 1, column: SIZE - 1 }]);
  await expect(page.getByTestId("patches-preview")).toHaveCount(0);
  await page.mouse.up();
  await expect(regions(page)).toHaveCount(0);
  await expect(status(page)).toContainText("Start on a clue");
});

test("dragging up from a middle clue and back down keeps the rows above", async ({ page }) => {
  const { rect, clue } = interior;
  const preview = page.getByTestId("patches-preview");
  const topLeft = { row: rect.row, column: rect.column };
  const bottomRight = { row: rect.row + rect.height - 1, column: rect.column + rect.width - 1 };

  // First leg: from the clue to the top-left corner. So far the patch spans only that stretch.
  await dragThrough(page, SIZE, [clue, topLeft]);
  await expect(preview).toContainText(`${clue.column - rect.column + 1}×${clue.row - rect.row + 1}`);

  // Back down past the clue row. An anchor-to-cursor rectangle would drop the rows above here.
  const grid = board(page).getByRole("grid");
  const end = await cellCenter(grid, SIZE, bottomRight);
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await expect(preview).toContainText(`${rect.width}×${rect.height}`);
  await expect(preview).toHaveAttribute("data-status", "valid");
  await page.mouse.up();

  await expect(regions(page)).toHaveCount(1);
  await expect(status(page)).toContainText(`${rect.width} by ${rect.height}`);
});

test("a legal patch stays on the board even when it is the wrong answer, until it is tapped", async ({ page }) => {
  const wrong = legalButWrong();
  await draw(page, SIZE, wrong);
  await expect(regions(page)).toHaveCount(1);
  await expect(status(page)).toContainText("Placed");

  // The game itself never comments: a tap takes the patch off, like any other.
  await tapCell(page, SIZE, { row: wrong.rect.row, column: wrong.rect.column });
  await expect(regions(page)).toHaveCount(0);

  // Only a hint calls it out: it flags the patch, then takes it off itself.
  await draw(page, SIZE, wrong);
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(regions(page).first()).toHaveAttribute("data-wrong", "true");
  await expect(regions(page)).toHaveCount(0);
});

test("drawing again from a clue replaces its patch, and one undo brings the old one back", async ({ page }) => {
  const wrong = legalButWrong();
  const right = targets.find((target) => target.clue.row === wrong.clue.row && target.clue.column === wrong.clue.column)!;
  await draw(page, SIZE, wrong);
  await draw(page, SIZE, right);
  await expect(regions(page)).toHaveCount(1);
  await expect(status(page)).toContainText("Redrew");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(regions(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(regions(page)).toHaveCount(0);
});

test("releasing outside the board, or pressing Escape, cancels the drag", async ({ page }) => {
  const { clue, rect } = targets[0];
  await dragThrough(page, SIZE, [clue, { row: rect.row, column: rect.column }]);
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120, { steps: 4 });
  await expect(page.getByTestId("patches-preview")).toHaveCount(0);
  await page.mouse.up();
  await expect(regions(page)).toHaveCount(0);

  await dragThrough(page, SIZE, [clue, { row: rect.row + rect.height - 1, column: rect.column + rect.width - 1 }]);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("patches-preview")).toHaveCount(0);
  await page.mouse.up();
  await expect(regions(page)).toHaveCount(0);
});

test("the mouse never leaves a keyboard focus ring on the board", async ({ page }) => {
  await draw(page, SIZE, targets[0]);
  await dragThrough(page, SIZE, [targets[1].clue, { row: targets[1].rect.row, column: targets[1].rect.column }]);
  expect(await page.locator(".mg-cell:focus-visible").count()).toBe(0);
  await page.mouse.up();
  expect(await page.locator(".mg-cell:focus-visible").count()).toBe(0);
});

test("tiles, clue tiles and patches share one geometry on whole pixels", async ({ page }) => {
  await draw(page, SIZE, targets[0]);
  // The patch scales in from 0.9. Measure it at rest.
  await regions(page).first().evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const grid = (await board(page).getByRole("grid").boundingBox())!;
  expect(grid.width % SIZE).toBe(0);
  expect(grid.width).toBe(grid.height);

  const step = grid.width / SIZE;
  const { rect } = targets[0];
  const patch = (await regions(page).first().boundingBox())!;
  expect(patch.x).toBeCloseTo(grid.x + rect.column * step, 5);
  expect(patch.y).toBeCloseTo(grid.y + rect.row * step, 5);
  expect(patch.width).toBeCloseTo(rect.width * step, 5);
  expect(patch.height).toBeCloseTo(rect.height * step, 5);

  // Same inset and radius for the clue tile and the patch that covers it: nothing square shows behind the corners.
  const geometry = await page.evaluate(() => {
    const tile = getComputedStyle(document.querySelector('.mg-cell[data-clue="true"]')!, "::before");
    const region = document.querySelector<HTMLElement>(".patches-region")!;
    return { tileInset: tile.top, tileRadius: tile.borderTopLeftRadius, patchInset: getComputedStyle(region).paddingTop, patchRadius: getComputedStyle(region.firstElementChild!).borderTopLeftRadius };
  });
  expect(geometry.patchInset).toBe(geometry.tileInset);
  expect(geometry.patchRadius).toBe(geometry.tileRadius);
});

test("events that arrive faster than React renders still paint the whole path", async ({ page }) => {
  const { rect, clue } = interior;
  // Everything fires in one task, so no render can happen between events. A handler that read the
  // gesture from React state would see stale data here: the tap would do nothing and the second
  // move would forget the rows the first one reached.
  const fire = (cells: { row: number; column: number }[], release: boolean) =>
    page.evaluate(
      ({ cells, size, release }) => {
        const boardElement = document.querySelector<HTMLElement>('[data-testid="patches-board"]')!;
        const box = boardElement.querySelector('[role="grid"]')!.getBoundingClientRect();
        const step = box.width / size;
        const send = (type: string, cell: { row: number; column: number }) =>
          boardElement.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              isPrimary: true,
              pointerId: 1,
              pointerType: "mouse",
              button: 0,
              clientX: box.left + (cell.column + 0.5) * step,
              clientY: box.top + (cell.row + 0.5) * step,
            }),
          );
        send("pointerdown", cells[0]);
        for (const cell of cells.slice(1)) send("pointermove", cell);
        if (release) send("pointerup", cells[cells.length - 1]);
      },
      { cells, size: SIZE, release },
    );

  await fire([clue, { row: rect.row, column: rect.column }, { row: rect.row + rect.height - 1, column: rect.column + rect.width - 1 }], true);
  await expect(regions(page)).toHaveCount(1);
  await expect(status(page)).toContainText(`${rect.width} by ${rect.height}`);

  // A press and release on the patch in the same task is still a tap.
  await fire([clue], true);
  await expect(regions(page)).toHaveCount(0);
});
