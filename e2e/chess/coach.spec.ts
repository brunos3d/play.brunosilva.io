import { expect, test } from "@playwright/test";
import { type Move, coachFor, explainWrongMove, moveFrom, movePromotion, moveTo, pieceType, positionAfter } from "@/games/chess/engine";
import { confirmReveal, inLocale, result, skipTutorials, status } from "../shared";
import { NOTATION, board, chessPuzzle, coach, openChess, solve, tapMove, tapSquare, tellings } from "./helpers";

/**
 * The coach speaks the game language and the rest of the page speaks the
 * interface locale. These tests set the two apart on purpose.
 */
const { puzzle, resolved, url } = chessPuzzle("e2e-chess-1", "medium");
const start = positionAfter(resolved, []);
const english = coachFor("en");
const portuguese = coachFor("pt-br");
const side = puzzle.solver === "white" ? { en: "White", pt: "brancas" } : { en: "Black", pt: "pretas" };

/** A wrong first move that loses material, found with the same analysis the coach uses. */
function losingMove(): Move {
  const found = start.legalMoves().find((move) => move !== resolved.line[0] && movePromotion(move) === 0 && explainWrongMove(start, move, puzzle.kind, puzzle.mateIn).kind === "loses-material");
  if (found === undefined) throw new Error("the fixture puzzle has no wrong move that loses material");
  return found;
}

test("with the game language in English, the coach speaks English in words", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "en" });
  await openChess(page, url);
  await expect(coach(page)).toHaveAttribute("lang", "en");
  await expect(coach(page)).toHaveAccessibleName("Sofia, coach");
  await expect(coach(page)).toContainText(english.intro(resolved).text);
  await expect(coach(page)).toContainText("there is a forced checkmate in 2 moves");
  await expect(coach(page)).toContainText(`You play ${side.en}.`);

  // An illegal move: the piece is named, the square is a coordinate.
  const from = moveFrom(resolved.line[0]);
  const reachable = new Set(start.legalMoves().filter((move) => moveFrom(move) === from).map(moveTo));
  const target = [...Array(64).keys()].find((square) => !reachable.has(square) && start.board[square] === 0)!;
  await tapSquare(page, puzzle, from);
  await tapSquare(page, puzzle, target);
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(status(page)).toHaveText(english.illegal("unreachable", pieceType(start.board[from]), target));

  // A wrong move: what it loses, and how to take it back, without the answer.
  await tapMove(page, puzzle, losingMove());
  await expect(status(page)).toHaveAttribute("data-kind", "invalid");
  await expect(status(page)).toContainText(/your \w+/);
  await expect(coach(page)).toContainText("Tap the board to take the move back.");
  for (const telling of tellings(english, start, resolved.line[0])) await expect(coach(page)).not.toContainText(telling, { ignoreCase: true });
  await tapSquare(page, puzzle, 0);
  await expect(board(page)).toHaveAttribute("data-take-back", "false");

  // Both hints: the piece, then the move in words.
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText(english.pieceHint(resolved, resolved.line[0]).text);
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(status(page)).toContainText(`The answer was to ${english.describeMove(start, resolved.line[0], "infinitive")}.`);
  await expect(board(page)).toHaveAttribute("data-locked", "false");

  await solve(page, puzzle, resolved, 2);
  await expect(status(page)).toHaveAttribute("data-kind", "success");
  await expect(status(page)).toContainText("checkmate", { ignoreCase: true });
  await expect(result(page)).toBeVisible();
  // Nothing she said along the way was notation, and nothing was Portuguese.
  await expect(coach(page)).not.toContainText(NOTATION);
  await expect(coach(page)).not.toContainText(/xeque|lance|adversário/);
});

test("the coach praises a right move and reveals the solution in English", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "en" });
  await openChess(page, url);
  await tapMove(page, puzzle, resolved.line[0]);
  await expect(status(page)).toContainText(english.describeMove(start, resolved.line[0], "clause"), { ignoreCase: true });
  await expect(status(page)).toContainText("Your opponent replied by ");
  await expect(board(page)).toHaveAttribute("data-locked", "false");

  // Revealed half way, she tells the rest of the line and not the move already on the board.
  await confirmReveal(page);
  await expect(coach(page)).toContainText(english.reveal(resolved, 2).text);
  await expect(coach(page)).toContainText("Here is the rest of the solution. You ");
  await expect(result(page)).toBeVisible({ timeout: 15_000 });
  await expect(status(page)).toContainText("Solution revealed. Study the idea and try the next one.");
  await expect(coach(page)).not.toContainText(NOTATION);
});

test("a Portuguese interface with an English coach", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "en" });
  await openChess(page, inLocale("pt-br", url));
  await expect(page).toHaveURL(/\/pt-br\/chess\/play/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

  // The page is Portuguese: controls, the board's label and what a screen reader hears on a square.
  await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();
  await expect(page.getByRole("grid")).toHaveAccessibleName(new RegExp(`^Tabuleiro de xadrez\\. Você joga de ${side.pt}\\.`));
  await tapSquare(page, puzzle, moveFrom(resolved.line[0]));
  await expect(board(page).locator('.chess-square[data-selected="true"]')).toHaveAttribute("aria-label", /^[a-h][1-8], (dama|torre|bispo|cavalo|peão|rei) (branc|pret)[ao], selecionada$/);
  await tapSquare(page, puzzle, moveFrom(resolved.line[0]));

  // The coach is English, and says so to assistive tools.
  await expect(coach(page)).toHaveAttribute("lang", "en");
  await expect(coach(page).getByTestId("chess-coach-role")).toHaveText("Coach");
  await expect(coach(page)).toContainText(english.intro(resolved).text);
  await tapMove(page, puzzle, resolved.line[0]);
  await expect(status(page)).toContainText("Your opponent replied by ");
  await expect(coach(page)).not.toContainText(/adversário|xeque/);
});

test("an English interface with a Portuguese coach", async ({ page }) => {
  await skipTutorials(page, { gameLanguage: "pt-br" });
  await openChess(page, inLocale("en", url));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("grid")).toHaveAccessibleName(new RegExp(`^Chess board\\. You play ${side.en}\\.`));
  await tapSquare(page, puzzle, moveFrom(resolved.line[0]));
  await expect(board(page).locator('.chess-square[data-selected="true"]')).toHaveAttribute("aria-label", /^[a-h][1-8], (white|black) (queen|rook|bishop|knight|pawn|king), selected$/);
  await tapSquare(page, puzzle, moveFrom(resolved.line[0]));

  await expect(coach(page)).toHaveAttribute("lang", "pt-BR");
  await expect(coach(page).getByTestId("chess-coach-role")).toHaveText("Treinadora");
  await expect(coach(page)).toContainText(portuguese.intro(resolved).text);
  await tapMove(page, puzzle, resolved.line[0]);
  await expect(status(page)).toContainText("O adversário respondeu ");
  await expect(coach(page)).not.toContainText(/opponent|check\b/);
});

test("changing the game language in the middle of a puzzle changes only what the coach says next", async ({ page }) => {
  await skipTutorials(page);
  await openChess(page, url);
  const intro = portuguese.intro(resolved).text;
  await expect(coach(page)).toContainText(intro);
  await tapMove(page, puzzle, resolved.line[0]);
  await expect(status(page)).toContainText("O adversário respondeu ");
  await expect(board(page)).toHaveAttribute("data-locked", "false");

  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByTestId("game-settings");
  await settings.getByTestId("settings-game-language").locator('[data-value="en"]').click();
  await expect(settings.getByTestId("settings-game-language").locator('[data-value="en"]')).toHaveAttribute("aria-pressed", "true");
  await settings.getByRole("button", { name: "Close" }).click();
  await expect(settings).toBeHidden();

  // The interface did not move, the puzzle is where it was, and the panel is now an English one.
  await expect(page).toHaveURL(/\/en\/chess\/play/);
  await expect(board(page)).toHaveAttribute("data-locked", "false");
  await expect(coach(page)).toHaveAttribute("lang", "en");
  await expect(coach(page).getByTestId("chess-coach-role")).toHaveText("Coach");

  // What she already said stays as she said it, marked as Portuguese inside the English panel.
  const said = coach(page).locator(".chess-bubble");
  await expect(said).toHaveCount(2);
  await expect(said.first()).toHaveText(intro);
  await expect(said.first()).toHaveAttribute("lang", "pt-BR");
  await expect(said.nth(1)).toContainText("O adversário respondeu ");

  // The next lines are English: a hint, then the mate.
  const second = positionAfter(resolved, resolved.line.slice(0, 2));
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect(said).toHaveCount(3);
  await expect(said.nth(2)).toHaveText(english.pieceHint(resolved, resolved.line[2]).text);
  await expect(said.nth(2)).not.toHaveAttribute("lang");
  await tapMove(page, puzzle, resolved.line[2]);
  await expect(status(page)).toContainText(english.describeMove(second, resolved.line[2], "clause").replace(": checkmate", ""), { ignoreCase: true });
  await expect(status(page)).toContainText("checkmate", { ignoreCase: true });
  await expect(said.first()).toHaveText(intro);
  await expect(result(page)).toBeVisible();
});

test("in the tutorial the steps follow the interface and the coach follows the game language", async ({ page }) => {
  // No tutorial seen yet, a Portuguese interface and an English coach.
  await page.addInitScript(() => localStorage.setItem("minigames:settings:v1", JSON.stringify({ sound: false, haptics: false, gameLanguage: "en", tutorials: {} })));
  await page.goto(inLocale("pt-br", url));
  const tutorial = page.getByTestId("game-tutorial");
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByRole("heading", { name: "Como jogar Xadrez" })).toBeVisible();
  await expect(tutorial).toContainText("1. O adversário joga primeiro");
  await expect(tutorial).toContainText("2. Faça o seu lance");
  await expect(tutorial.getByRole("grid")).toHaveAccessibleName("Tabuleiro do tutorial. Você joga de brancas.");
  await expect(tutorial.getByRole("button", { name: "Dica" })).toBeVisible();
  await expect(tutorial.getByRole("button", { name: "Pular" })).toBeVisible();

  const line = tutorial.getByTestId("chess-tutorial-coach");
  await expect(line).toHaveAttribute("lang", "en");
  await expect(line).toContainText("Black moved the rook to a2. That left their king with no way out. You play White: give checkmate in 1 move.");
  await tutorial.getByRole("button", { name: "Dica" }).click();
  await expect(line).toContainText("Hint: the piece to move is the rook on e1. The enemy king is stuck on the back rank.");

  // The teaching board is a back-rank mate: rook from e1 to e8, White at the bottom.
  const box = (await tutorial.getByTestId("chess-board").boundingBox())!;
  const at = (file: number, rank: number) => ({ x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7 - rank + 0.5) * box.height) / 8 });
  await page.mouse.click(at(4, 0).x, at(4, 0).y);
  await page.mouse.click(at(4, 7).x, at(4, 7).y);
  await expect(tutorial).toContainText("É assim que funciona");
  await expect(line).toContainText("The rook goes to e8");
  await tutorial.getByRole("button", { name: "Começar a jogar" }).click();
  await expect(tutorial).toBeHidden();
});
