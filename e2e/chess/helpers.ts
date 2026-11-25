import { type Page, expect } from "@playwright/test";
import { type ChessPuzzle, type Coach, type Move, type MoveForm, type Position, type ResolvedPuzzle, chessSeeds, generateChessFromSpec, moveFrom, moveTo, resolvePuzzle } from "@/games/chess/engine";

export function chessPuzzle(seed: string, difficulty: string): { puzzle: ChessPuzzle; resolved: ResolvedPuzzle; url: string } {
  const puzzle = generateChessFromSpec(chessSeeds.resolve({ seed, difficulty }));
  return { puzzle, resolved: resolvePuzzle(puzzle), url: `/chess/play?seed=${encodeURIComponent(puzzle.seed)}` };
}

export const board = (page: Page) => page.getByTestId("chess-board").first();
export const pieces = (page: Page) => board(page).getByTestId("chess-piece");
export const verdict = (page: Page) => board(page).getByTestId("chess-verdict");
export const coach = (page: Page) => page.getByTestId("chess-coach");

/** Chess notation in any shape: a piece letter stuck to a square ("Txd1", "Qh4"), a capture between squares, castling, a check or mate sign. The coach uses none of it. */
export const NOTATION = /\b[KQRBNTDC][a-h1-8]?x?[a-h][1-8]\b|\b[a-h]x[a-h][1-8]\b|O-O|[+#]/;

const FORMS: readonly MoveForm[] = ["clause", "infinitive", "past", "pastPlural", "present", "gerund"];

/** A move in every wording a coach has for it. */
export function tellings(sofia: Coach, position: Position, move: Move): string[] {
  return [...new Set(FORMS.map((form) => sofia.describeMove(position, move, form)))];
}

/** Opens a puzzle and waits for the opponent's opening move, after which the board takes input. */
export async function openChess(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute("data-locked", "false");
}

/** Centre of a square on screen. The board is drawn from the solver's side, so Black's view is turned around. */
export async function squarePoint(page: Page, puzzle: ChessPuzzle, square: number) {
  const box = (await board(page).boundingBox())!;
  const file = square & 7;
  const rank = square >> 3;
  const column = puzzle.solver === "white" ? file : 7 - file;
  const row = puzzle.solver === "white" ? 7 - rank : rank;
  return { x: box.x + ((column + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
}

export async function tapSquare(page: Page, puzzle: ChessPuzzle, square: number): Promise<void> {
  const point = await squarePoint(page, puzzle, square);
  await page.mouse.click(point.x, point.y);
}

/** Two taps: the piece, then where it goes. */
export async function tapMove(page: Page, puzzle: ChessPuzzle, move: Move): Promise<void> {
  await tapSquare(page, puzzle, moveFrom(move));
  await tapSquare(page, puzzle, moveTo(move));
}

/** Picks the piece up with the real mouse and drops it on its square. */
export async function dragMove(page: Page, puzzle: ChessPuzzle, move: Move): Promise<void> {
  const from = await squarePoint(page, puzzle, moveFrom(move));
  const to = await squarePoint(page, puzzle, moveTo(move));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

/** Plays the whole solution with taps, waiting for each of the opponent's replies. */
export async function solve(page: Page, puzzle: ChessPuzzle, resolved: ResolvedPuzzle, from = 0): Promise<void> {
  for (let index = from; index < resolved.line.length; index += 2) {
    await expect(board(page)).toHaveAttribute("data-locked", "false");
    await tapMove(page, puzzle, resolved.line[index]);
  }
}
