import type { GameLanguage } from "@/i18n/game-language";
import type { Move, Position } from "../position";
import type { ResolvedPuzzle } from "../puzzle";
import type { Feedback, IllegalReason } from "./feedback";

export type CoachMood = "calm" | "happy" | "worried" | "thinking";
export type CoachMessage = { mood: CoachMood; text: string };

/**
 * The grammatical shape a move is told in. The sentences around a move decide
 * which one they need:
 *
 * - `clause`: the piece is the subject. "a torre captura o bispo em e1", "the rook takes the bishop on e1".
 * - `infinitive`: "mover a torre para d1", "move the rook to d1". English also uses it after "you".
 * - `past`: one player did it. "moveu a torre para d1", "moved the rook to d1".
 * - `pastPlural`: a side did it. Portuguese sides are plural, "as pretas moveram". English has one past form.
 * - `present`: one player does it. "move a torre para d1", "moves the rook to d1".
 * - `gerund`: "movendo a torre para d1", "moving the rook to d1".
 */
export type MoveForm = "clause" | "infinitive" | "past" | "pastPlural" | "present" | "gerund";

/** Fixed lines and labels of the coach that depend on nothing in the game. */
export type CoachText = {
  name: string;
  role: string;
  /** Read by screen readers while the dots of the typing bubble show. */
  thinking: string;
  undone: string;
  reset: string;
  /** The note under the chat while a wrong move waits on the board. */
  takeBack: string;
  resumed: string;
  revealed: string;
  solvedBefore: string;
};

/**
 * Everything the coach says, in one language. The game picks an implementation
 * with `coachFor` and never builds a sentence of its own.
 *
 * No message contains chess notation: a move is always told in words, by
 * `describeMove`. And no message names the move the player has to find, except
 * `moveHint` and `reveal`, which exist to do exactly that.
 *
 * `variant` is a counter kept by the caller. It picks one of several wordings,
 * so the same game always reads the same.
 */
export type Coach = {
  language: GameLanguage;
  text: CoachText;
  /**
   * A legal move of this position in words, with what it gives: check or mate.
   * `after` is the move played right before it. A capture of the piece that
   * move brought is told without the square, which was just named.
   */
  describeMove(position: Position, move: Move, form: MoveForm, after?: Move): string;
  /** First message of a puzzle: what the opponent just played and what is asked. */
  intro(puzzle: ResolvedPuzzle): CoachMessage;
  /** After a right move that is not the last one. `position` is the board before the move, and `reply` is the opponent's answer. */
  praise(position: Position, move: Move, reply: Move, variant: number): CoachMessage;
  /** After the move that solves the puzzle. `position` is the board before it. */
  solved(puzzle: ResolvedPuzzle, position: Position, move: Move, variant: number): CoachMessage;
  /** After a wrong move. `position` is the board before it. The text says what the move allows or misses, never what should have been played. */
  wrong(position: Position, move: Move, feedback: Feedback, variant: number): CoachMessage;
  /** First hint for a move: which piece moves, plus the idea behind the puzzle. The board highlights the piece's square. */
  pieceHint(puzzle: ResolvedPuzzle, move: Move): CoachMessage;
  /** Second hint: the coach plays the move. `position` is the board before it. */
  moveHint(position: Position, move: Move): CoachMessage;
  /** A hint asked for while a wrong move is on the board: the coach takes it back. */
  takeBackHint(): CoachMessage;
  /** Why a piece of type `piece` may not go to `square`. Said once, never kept in the chat. */
  illegal(reason: IllegalReason, piece: number, square: number): string;
  /** The solution in words, from half-move `from` of the line to its end. */
  reveal(puzzle: ResolvedPuzzle, from?: number): CoachMessage;
};
