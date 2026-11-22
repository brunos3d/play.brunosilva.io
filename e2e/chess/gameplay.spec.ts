import { expect, test } from "@playwright/test";
import { LETTERS_PT, type Move, explainWrongMove, moveCaptured, moveFrom, movePromotion, moveTo, positionAfter, squareName, toSan } from "@/games/chess/engine";
import { confirmReveal, result, skipTutorials, status, timer, watchConsole } from "../shared";
import { board, chessPuzzle, coach, dragMove, openChess, pieces, solve, tapMove, tapSquare, verdict } from "./helpers";

// A mate in two: two solver moves with a reply in between, which is the shortest puzzle that exercises the whole flow.
const { puzzle, resolved, url } = chessPuzzle("e2e-chess-1", "medium");
const start = positionAfter(resolved, []);
const firstSan = toSan(start, resolved.line[0], LETTERS_PT);

/** A wrong first move of the kind the test asks for, found with the same analysis the coach uses. */
function wrongMove(kind: "loses-material" | "other"): Move {
  const found = start.legalMoves().find((move) => {
    if (move === resolved.line[0] || movePromotion(move) !== 0) return false;
    const feedback = explainWrongMove(start, move, puzzle.kind, puzzle.mateIn);
    return kind === "loses-material" ? feedback.kind === "loses-material" : feedback.kind === "too-slow" || feedback.kind === "check-answered";
  });
  if (found === undefined) throw new Error(`the fixture puzzle has no wrong move of kind ${kind}`);
  return found;
}

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

test("the fixture is a mate in two", () => {
  expect(puzzle.kind).toBe("mate");
  expect(puzzle.mateIn).toBe(2);
  expect(resolved.line).toHaveLength(3);
});

test("the opponent moves first, then taps solve the puzzle and the coach follows along", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(url);
  // The board opens on the position before the opponent's move and takes no input until it has been played.
  await expect(board(page)).toHaveAttribute("data-locked", "true");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(board(page).locator('.chess-square[data-last="true"]')).toHaveCount(2);
  await expect(coach(page)).toContainText("xeque-mate forçado em 2 lances");
  await expect(coach(page)).toContainText(`Você joga de ${puzzle.solver === "white" ? "brancas" : "pretas"}`);

  // Selecting a piece shows where it can go.
  await tapSquare(page, puzzle, moveFrom(resolved.line[0]));
  await expect(board(page).locator('.chess-square[data-selected="true"]')).toHaveAttribute("data-square", squareName(moveFrom(resolved.line[0])));
  expect(await board(page).getByTestId("chess-target").count()).toBeGreaterThan(0);
  await tapSquare(page, puzzle, moveTo(resolved.line[0]));

  await expect(verdict(page)).toHaveAttribute("data-good", "true");
  await expect(status(page)).toContainText(firstSan);
  await expect(status(page)).toContainText("O adversário respondeu");

  await solve(page, puzzle, resolved, 2);
  await expect(status(page)).toContainText("#");
  await expect(status(page)).toHaveAttribute("data-kind", "success");
  await expect(board(page).locator('.chess-square[data-check="true"]')).toHaveCount(1);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Flawless");
  await expect(result(page).getByText("Mistakes")).toBeVisible();
  expect(problems).toEqual([]);
});

test("pieces can be dragged, and a dragged capture takes the piece off the board", async ({ page }) => {
  await openChess(page, url);
  const before = await pieces(page).count();
  await dragMove(page, puzzle, resolved.line[0]);
  await expect(board(page).locator(`[data-testid="chess-piece"][data-square="${squareName(moveTo(resolved.line[0]))}"]`)).toHaveCount(1);
  await expect(verdict(page)).toHaveAttribute("data-good", "true");
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  const captures = [resolved.line[0], resolved.line[1]].filter((move) => moveCaptured(move) !== 0).length;
  await expect(pieces(page)).toHaveCount(before - captures);
});

test("a wrong move stays on the board, the coach explains it without giving the answer, and a tap takes it back", async ({ page }) => {
  await openChess(page, url);
  const wrong = wrongMove("loses-material");
  await tapMove(page, puzzle, wrong);

  await expect(verdict(page)).toHaveAttribute("data-good", "false");
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(coach(page)).toContainText("Toque no tabuleiro para voltar o lance.");
  await expect(coach(page)).not.toContainText(firstSan);
  await expect(board(page)).toHaveAttribute("data-take-back", "true");
  // The punishment is on the board: the last move shown is the opponent's reply.
  await expect(board(page)).toHaveAttribute("data-turn", puzzle.solver);

  await tapSquare(page, puzzle, 0);
  await expect(board(page)).toHaveAttribute("data-take-back", "false");
  await expect(verdict(page)).toHaveCount(0);
  await expect(board(page)).toHaveAttribute("data-locked", "false");

  // A wrong move that loses nothing is left standing alone, and Undo takes it back too.
  await tapMove(page, puzzle, wrongMove("other"));
  await expect(verdict(page)).toHaveAttribute("data-good", "false");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(verdict(page)).toHaveCount(0);

  await solve(page, puzzle, resolved);
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText("Solved without hints");
  await expect(result(page).locator("dl")).toContainText("2");
});

test("an illegal move changes nothing and says why", async ({ page }) => {
  await openChess(page, url);
  const from = moveFrom(resolved.line[0]);
  const reachable = new Set(start.legalMoves().filter((move) => moveFrom(move) === from).map(moveTo));
  const target = [...Array(64).keys()].find((square) => !reachable.has(square) && start.board[square] === 0)!;
  await tapSquare(page, puzzle, from);
  await tapSquare(page, puzzle, target);
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(status(page)).toContainText(`não pode ir para ${squareName(target)}`);
  await expect(board(page)).toHaveAttribute("data-shake", "true");
  await expect(verdict(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("the first hint shows the piece, the second plays the move, and both are counted", async ({ page }) => {
  await openChess(page, url);
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(board(page).locator('.chess-square[data-hint="true"]')).toHaveAttribute("data-square", squareName(moveFrom(resolved.line[0])));
  await expect(status(page)).toContainText("Dica:");
  await expect(status(page)).not.toContainText(firstSan);

  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText(`O lance era ${firstSan}`);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(page.getByRole("button", { name: "Hint. 2 used." })).toBeVisible();

  // Undo steps back one full move, and Reset is then out of work.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
});

test("reveal plays the solution and the puzzle ends without a best time", async ({ page }) => {
  await openChess(page, url);
  await confirmReveal(page);
  await expect(coach(page)).toContainText("A solução era");
  await expect(result(page)).toBeVisible({ timeout: 15_000 });
  await expect(result(page)).toContainText("Solution revealed");
  await expect(board(page).locator('.chess-square[data-check="true"]')).toHaveCount(1);
});

test("progress survives a reload, with the clock still running", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-23T18:00:00Z") });
  await openChess(page, url);
  await tapMove(page, puzzle, resolved.line[0]);
  await expect(status(page)).toContainText("O adversário respondeu");
  const count = await pieces(page).count();

  await page.clock.fastForward("01:30");
  await page.reload();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(pieces(page)).toHaveCount(count);
  await expect(coach(page)).toContainText("Você parou aqui");
  await expect(timer(page)).toContainText(/01:3\d/);
  await solve(page, puzzle, resolved, 2);
  await expect(result(page)).toBeVisible();
});

test("practice never runs out: New loads another puzzle of the same difficulty", async ({ page }) => {
  await openChess(page, url);
  await page.getByTestId("game-new").click();
  await expect(page).toHaveURL(/seed=CHESS%3A[a-z0-9]+%3A1%3Amedium$/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});

test("the practice setup has no board size and builds a chess seed", async ({ page }) => {
  await page.goto("/chess/practice");
  await expect(page.getByRole("button", { name: "expert" })).toBeVisible();
  await expect(page.getByText("Board size")).toHaveCount(0);
  expect(await page.locator('link[rel="icon"][type="image/svg+xml"]').first().getAttribute("href")).toContain("/icons/chess.svg");
  await page.getByRole("button", { name: "easy" }).click();
  await page.getByTestId("game-seed-input").fill("my seed");
  await page.getByTestId("game-start").click();
  await expect(page).toHaveURL(/seed=CHESS%3Amy-seed%3A1%3Aeasy$/);
  await expect(board(page)).toBeVisible();
  await expect(page.getByText("easy", { exact: true })).toBeVisible();
});

test("the tutorial teaches the two things a new player needs and then gets out of the way", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, tutorials: {} })));
  await page.goto(url);
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toContainText("O adversário joga primeiro");
  await expect(tutorial).toContainText("Faça o seu lance");
  // The teaching board is a back-rank mate: rook from e1 to e8, White at the bottom.
  const box = (await tutorial.getByTestId("chess-board").boundingBox())!;
  const at = (file: number, rank: number) => ({ x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7 - rank + 0.5) * box.height) / 8 });
  await page.mouse.click(at(4, 0).x, at(4, 0).y);
  await page.mouse.click(at(4, 7).x, at(4, 7).y);
  await expect(tutorial).toContainText("É assim que funciona");
  await tutorial.getByRole("button", { name: "Começar a jogar" }).click();
  await expect(tutorial).toBeHidden();
  // The clock only starts once the tutorial is closed, and so does the opponent's opening move.
  await expect(board(page)).toHaveAttribute("data-locked", "false");
});
