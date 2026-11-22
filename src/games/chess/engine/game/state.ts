import { type Move, moveFrom, movePromotion, moveTo } from "../position";
import { type ResolvedPuzzle, positionAfter } from "../puzzle";
import { isCheckmate } from "../search";

export type ChessStatus = "playing" | "solved";

/** A wrong move left on the board until the player takes it back, with the reply that punishes it when the coach shows one. */
export type WrongMove = { move: Move; reply: Move | null };

export type ChessState = {
  puzzleId: string;
  /**
   * Solution half-moves on the board, opponent replies included. Even while
   * the solver is to move, odd for the instant between a right move and the
   * reply, and equal to the line's length once the puzzle is solved.
   */
  progress: number;
  wrong: WrongMove | null;
  /** The move that ended the puzzle when the player found a different mate from the stored one. It replaces the last move of the line on the board. */
  finish: Move | null;
  status: ChessStatus;
  /** Moves the player made, right or wrong. Moves played by a hint do not count. */
  moves: number;
  /** Wrong moves. */
  mistakes: number;
  hintsUsed: number;
  /** How much of a hint the move to find has had: 0 nothing yet, 1 the piece is shown. */
  hintStage: 0 | 1;
  /** The player asked for the solution. The board accepts no input from then on. */
  revealed: boolean;
};

export function createChessGame(puzzleId: string): ChessState {
  return { puzzleId, progress: 0, wrong: null, finish: null, status: "playing", moves: 0, mistakes: 0, hintsUsed: 0, hintStage: 0, revealed: false };
}

export function isChessLocked(state: ChessState): boolean {
  return state.status === "solved" || state.revealed;
}

/** Moves on the board after the opening move: the solution so far, then a wrong move and its punishment if one is showing. */
export function movesOnBoard(puzzle: ResolvedPuzzle, state: ChessState): Move[] {
  const moves = puzzle.line.slice(0, state.progress);
  if (state.finish !== null && moves.length > 0) moves[moves.length - 1] = state.finish;
  if (state.wrong) {
    moves.push(state.wrong.move);
    if (state.wrong.reply !== null) moves.push(state.wrong.reply);
  }
  return moves;
}

/** The legal move from one square to another, or 0. A pawn reaching the last rank needs `promotion`, and without it this returns 0 so the UI can ask. */
export function findMove(puzzle: ResolvedPuzzle, state: ChessState, from: number, to: number, promotion = 0): Move {
  if (state.wrong || isChessLocked(state)) return 0;
  const position = positionAfter(puzzle, puzzle.line.slice(0, state.progress));
  for (const move of position.legalMoves()) {
    if (moveFrom(move) === from && moveTo(move) === to && movePromotion(move) === promotion) return move;
  }
  return 0;
}

/**
 * Whether a move solves the step. The solution move always does. So does any
 * move that gives checkmate on the spot: a puzzle cannot fault a mate.
 */
export function isSolutionMove(puzzle: ResolvedPuzzle, state: ChessState, move: Move): boolean {
  if (move === puzzle.line[state.progress]) return true;
  const position = positionAfter(puzzle, puzzle.line.slice(0, state.progress));
  position.make(move);
  return isCheckmate(position);
}

export type MoveOutcome = "solved" | "continue" | "wrong";

/**
 * Plays a legal move for the solver. A right move advances the line, and when
 * it is not the last one the opponent's reply is still to come (see
 * `playReply`). A wrong move stays on the board, marked, until `takeBack`.
 */
export function playMove(puzzle: ResolvedPuzzle, state: ChessState, move: Move): { state: ChessState; outcome: MoveOutcome } {
  if (isChessLocked(state) || state.wrong || state.progress % 2 !== 0) return { state, outcome: "wrong" };
  const moves = state.moves + 1;
  if (!isSolutionMove(puzzle, state, move)) {
    return { state: { ...state, moves, mistakes: state.mistakes + 1, wrong: { move, reply: null } }, outcome: "wrong" };
  }
  const next = { ...state, moves, hintStage: 0 as const, progress: state.progress + 1 };
  // A mate that is not the stored move ends the puzzle too, wherever in the line it happens.
  if (move !== puzzle.line[state.progress]) return { state: { ...next, finish: move, status: "solved" }, outcome: "solved" };
  if (next.progress === puzzle.line.length) return { state: { ...next, status: "solved" }, outcome: "solved" };
  return { state: next, outcome: "continue" };
}

/** The opponent answers a right move. */
export function playReply(puzzle: ResolvedPuzzle, state: ChessState): ChessState {
  if (state.status === "solved" || state.progress % 2 === 0 || state.progress >= puzzle.line.length) return state;
  return { ...state, progress: state.progress + 1 };
}

/** Shows the opponent's punishment of the wrong move on the board. */
export function showPunishment(state: ChessState, reply: Move): ChessState {
  return state.wrong ? { ...state, wrong: { ...state.wrong, reply } } : state;
}

export function canUndoChess(state: ChessState): boolean {
  return !isChessLocked(state) && (state.wrong !== null || state.progress >= 2);
}

/**
 * Undo. A wrong move is taken back first. Otherwise the last full move comes
 * off: the player's move and the reply to it. The counters stay, since they
 * record what happened.
 */
export function undoChess(state: ChessState): ChessState {
  if (isChessLocked(state)) return state;
  if (state.wrong) return { ...state, wrong: null };
  if (state.progress < 2) return state;
  return { ...state, progress: state.progress - 2 - (state.progress % 2), hintStage: 0 };
}

/** Back to the position after the opponent's opening move. The clock and the counters survive. */
export function resetChess(state: ChessState): ChessState {
  if (isChessLocked(state) || (state.progress === 0 && !state.wrong)) return state;
  return { ...state, progress: 0, wrong: null, hintStage: 0 };
}

/** Counts a hint. The first one for a move shows the piece, the second plays the move. */
export function recordChessHint(state: ChessState): ChessState {
  return { ...state, hintsUsed: state.hintsUsed + 1, hintStage: state.wrong ? state.hintStage : state.hintStage === 0 ? 1 : 0 };
}

/** Plays the next half-move of the solution for the player: by a hint, or during the reveal. */
export function playSolutionStep(puzzle: ResolvedPuzzle, state: ChessState): ChessState {
  if (state.status === "solved") return state;
  const progress = Math.min(puzzle.line.length, state.progress + 1);
  return { ...state, wrong: null, hintStage: 0, progress, status: progress === puzzle.line.length ? "solved" : "playing" };
}

/** Marks the board as given up. From then on only `playSolutionStep` moves it. */
export function beginReveal(state: ChessState): ChessState {
  return { ...state, wrong: null, hintStage: 0, revealed: true };
}
