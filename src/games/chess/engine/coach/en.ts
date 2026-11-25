import { BLACK, type Color, KING, type Move, PAWN, type Position, moveFrom, movePiece, movePromotion, opposite, squareName } from "../position";
import { type ResolvedPuzzle, positionAfter } from "../puzzle";
import type { ChessTheme } from "../types";
import type { Coach, CoachMessage, MoveForm } from "./coach";
import { type MoveFacts, capital, moveFacts, pick, positionBeforeSetup, solverMoves, themeHint } from "./facts";
import type { Feedback } from "./feedback";

/**
 * The coach in English: the nouns and verbs of the move describer, and every
 * sentence she says.
 */

/** Indexed by piece type. Index 0 is a piece of unknown type. */
const PIECES: readonly string[] = ["piece", "pawn", "knight", "bishop", "rook", "queen", "king"];

const the = (type: number): string => `the ${PIECES[type]}`;
const a = (type: number): string => `a ${PIECES[type]}`;
const your = (type: number): string => `your ${PIECES[type]}`;
const side = (color: Color): string => (color === BLACK ? "Black" : "White");
const moves = (count: number): string => (count === 1 ? "1 move" : `${count} moves`);

type Verb = Record<Exclude<MoveForm, "clause">, string>;
/** English has one past form, so a side and a player share it. */
const verb = (infinitive: string, past: string, present: string, gerund: string): Verb => ({ infinitive, past, pastPlural: past, present, gerund });
const MOVE = verb("move", "moved", "moves", "moving");
const ADVANCE = verb("advance", "advanced", "advances", "advancing");
const TAKE = verb("take", "took", "takes", "taking");
const CASTLE = verb("castle", "castled", "castles", "castling");
const PROMOTE = verb("promote", "promoted", "promotes", "promoting");

/**
 * The move itself, without what it gives. In `clause` the piece is the subject
 * ("the rook goes to d1"). In every other form the player is, and the phrase
 * starts with the verb ("move the rook to d1").
 */
function phrase(facts: MoveFacts, form: MoveForm): string {
  const square = squareName(facts.to);
  // Two rooks that can both go there: "the rook on a1".
  const mover = `${the(facts.piece)}${facts.ambiguous ? ` on ${squareName(facts.from)}` : ""}`;

  if (facts.castle) {
    const wing = facts.castle === "king" ? "kingside" : "queenside";
    return form === "clause" ? `the king castles ${wing}` : `${CASTLE[form]} ${wing}`;
  }
  if (facts.promotion) {
    const becomes = a(facts.promotion);
    if (facts.captured) {
      const taken = `${the(facts.captured)} on ${square}`;
      return form === "clause" ? `${mover} takes ${taken} and becomes ${becomes}` : `${TAKE[form]} ${taken} with ${mover} and ${PROMOTE[form]} it to ${becomes}`;
    }
    return form === "clause" ? `${mover} reaches ${square} and becomes ${becomes}` : `${PROMOTE[form]} ${mover} to ${becomes} on ${square}`;
  }
  if (facts.enPassant) {
    return form === "clause" ? `${mover} takes en passant on ${square}` : `${TAKE[form]} the pawn en passant on ${square}${facts.ambiguous ? ` with ${mover}` : ""}`;
  }
  if (facts.captured) {
    const taken = `${the(facts.captured)}${facts.recapture ? "" : ` on ${square}`}`;
    return form === "clause" ? `${mover} takes ${taken}` : `${TAKE[form]} ${taken} with ${mover}`;
  }
  if (facts.piece === PAWN) return form === "clause" ? `${mover} advances to ${square}` : `${ADVANCE[form]} ${mover} to ${square}`;
  return form === "clause" ? `${mover} goes to ${square}` : `${MOVE[form]} ${mover} to ${square}`;
}

/** What the move gives, to end the phrase with. A second gerund in a row reads badly, so that form joins with "and". */
function tail(facts: MoveFacts, form: MoveForm): string {
  if (facts.mate) return ": checkmate";
  if (facts.check) return form === "gerund" ? " and giving check" : ", giving check";
  return "";
}

function describeMove(position: Position, move: Move, form: MoveForm, after?: Move): string {
  const facts = moveFacts(position, move, after);
  return `${phrase(facts, form)}${tail(facts, form)}`;
}

function intro(puzzle: ResolvedPuzzle): CoachMessage {
  const played = `${side(opposite(puzzle.solver))} ${describeMove(positionBeforeSetup(puzzle), puzzle.setup, "past")}.`;
  const you = `You play ${side(puzzle.solver)}`;
  const { kind, mateIn } = puzzle.shape;
  const count = solverMoves(puzzle);

  if (kind === "mate") {
    const text = mateIn === 1 ? `${played} That left their king with no way out. ${you}: give checkmate in 1 move.` : `${played} That was a mistake: there is a forced checkmate in ${moves(mateIn)}. ${you}.`;
    return { mood: "calm", text };
  }
  if (kind === "defence") return { mood: "calm", text: `${played} That is a serious threat. ${you}, and only one move holds the position together.` };
  const text = count === 1 ? `${played} That move left material for free. ${you}: find the move that wins it.` : `${played} It looks safe, but it loses material in ${moves(count)}. ${you}.`;
  return { mood: "calm", text };
}

function praise(position: Position, move: Move, reply: Move, variant: number): CoachMessage {
  const played = describeMove(position, move, "clause");
  position.make(move);
  const answer = describeMove(position, reply, "gerund", move);
  position.unmake(move);
  const opening = pick([`Nice! ${capital(played)}.`, `That's it: ${played}.`, `Exactly: ${played}.`, `Well done: ${played}.`], variant);
  const closing = pick(["How do you continue?", "What now?", "What is the next step?", "Now finish the job."], variant >> 1);
  return { mood: "happy", text: `${opening} Your opponent replied by ${answer}. ${closing}` };
}

function solved(puzzle: ResolvedPuzzle, position: Position, move: Move, variant: number): CoachMessage {
  const facts = moveFacts(position, move);
  const action = phrase(facts, "clause");
  if (facts.mate) {
    return { mood: "happy", text: pick([`Checkmate! ${capital(action)} and the game is over. Well done.`, `${capital(action)} and that's it: checkmate. Lovely move!`, `${capital(action)}: checkmate. Perfect!`], variant) };
  }
  const played = `${action}${tail(facts, "clause")}`;
  if (puzzle.shape.kind === "defence") return { mood: "happy", text: `${capital(played)}: that was the only move. Position saved, well done!` };
  if (facts.promotion) return { mood: "happy", text: `${capital(played)}. Now the advantage is yours.` };
  if (facts.captured) {
    return { mood: "happy", text: pick([`${capital(played)}. Material won, puzzle solved.`, `Perfect: ${played}. The advantage is yours.`, `Well done! ${capital(played)}. You came out ahead.`], variant) };
  }
  return { mood: "happy", text: `${capital(played)}. Now the advantage is yours. Puzzle solved.` };
}

function wrong(position: Position, move: Move, feedback: Feedback, variant: number): CoachMessage {
  const moved = movePromotion(move) || movePiece(move);
  position.make(move);
  // The opponent's answer, told from the position the wrong move leaves.
  const answer = (reply: Move, form: MoveForm): string => describeMove(position, reply, form);
  let text: string;

  switch (feedback.kind) {
    case "mated":
      text = feedback.mateIn === 1 ? `Careful! After that move, your opponent ${answer(feedback.reply, "present")}.` : `Careful! Now your opponent ${answer(feedback.reply, "present")}. Mate comes on the next move.`;
      break;
    case "loses-material": {
      const square = squareName(feedback.square);
      if (feedback.lost === 0) text = `That move does not work. Your opponent ${answer(feedback.reply, "present")}, and you lose material.`;
      else if (feedback.moved) {
        const taker = movePiece(feedback.reply);
        text = pick([`What about ${your(feedback.lost)}? On ${square}, it is taken by ${the(taker)}.`, `Oops, ${your(feedback.lost)} is left unprotected on ${square}. Your opponent takes it with ${the(taker)}.`], variant);
      } else if (moved !== KING && moved !== feedback.lost) {
        text = `You moved ${the(moved)}, but what about ${your(feedback.lost)}? Your opponent ${answer(feedback.reply, "present")}.`;
      } else {
        text = `But what about ${your(feedback.lost)}? After that move, your opponent ${answer(feedback.reply, "present")}.`;
      }
      break;
    }
    case "check-answered": {
      // The answer is not played on the board, so it is something the opponent can do.
      const reply = answer(feedback.reply, "infinitive");
      text = pick([`It is check, but it is not enough: your opponent can ${reply}. The mate has to be forced all the way.`, `Check is not mate: here your opponent can ${reply}. Look for a stronger check.`], variant);
      break;
    }
    case "too-slow":
      text = pick(["That move gives the enemy king time to defend. In a forced mate, start with the checks.", "Without a check, your opponent can breathe. Look for a move that leaves no choice."], variant);
      break;
    case "slower-mate":
      text = "That move wins too, but there is a faster mate. Try again.";
      break;
    case "small-gain":
      text = pick([`Taking ${the(feedback.taken)} is not much. There is a bigger prize on the board.`, `That move wins ${a(feedback.taken)}, but your opponent's mistake is worth more than that.`], variant);
      break;
    case "misses": {
      if (!feedback.reply) text = "That move lets the chance slip. Look again at your opponent's last move.";
      else {
        const reply = answer(feedback.reply, "infinitive");
        text = pick([`After that move, your opponent can ${reply}, and the chance is gone.`, `That move lets the chance slip. To regroup, all your opponent has to do is ${reply}.`], variant);
      }
      break;
    }
  }
  position.unmake(move);
  return { mood: "worried", text };
}

const THEME_HINTS: Partial<Record<ChessTheme, string>> = {
  backRankMate: "The enemy king is stuck on the back rank.",
  smotheredMate: "The enemy king is hemmed in by its own pieces.",
  sacrifice: "Sometimes it pays to give up a piece to open the way.",
  fork: "Look for a move that attacks two pieces at once.",
  discoveredAttack: "Moving one piece can open a line for another.",
  hangingPiece: "One of your opponent's pieces has no defender.",
  promotion: "A pawn is close to becoming a queen.",
  defensiveMove: "See what your opponent's last move is attacking.",
};

function pieceHint(puzzle: ResolvedPuzzle, move: Move): CoachMessage {
  const idea = themeHint(puzzle, THEME_HINTS);
  const lead = `Hint: the piece to move is ${the(movePiece(move))} on ${squareName(moveFrom(move))}.`;
  return { mood: "thinking", text: idea ? `${lead} ${idea}` : puzzle.shape.kind === "mate" ? `${lead} Look for a check.` : lead };
}

function moveHint(position: Position, move: Move): CoachMessage {
  const facts = moveFacts(position, move);
  const played = `The answer was to ${phrase(facts, "infinitive")}${tail(facts, "infinitive")}.`;
  // A mate explains itself.
  return { mood: "thinking", text: facts.mate ? played : `${played} Notice why it works.` };
}

function reveal(puzzle: ResolvedPuzzle, from = 0): CoachMessage {
  const position = positionAfter(puzzle, puzzle.line.slice(0, from));
  const steps: string[] = [];
  for (let index = from; index < puzzle.line.length; index++) {
    const move = puzzle.line[index];
    // Even half-moves are the solver's. The first one told has no move before it in this message.
    const after = index > from ? puzzle.line[index - 1] : undefined;
    steps.push(index % 2 === 0 ? `You ${describeMove(position, move, "infinitive", after)}.` : `Your opponent ${describeMove(position, move, "present", after)}.`);
    position.make(move);
  }
  return { mood: "calm", text: `${from === 0 ? "Here is the solution." : "Here is the rest of the solution."} ${steps.join(" ")}` };
}

export const COACH_EN: Coach = {
  language: "en",
  text: {
    name: "Sofia",
    role: "Coach",
    thinking: "Sofia is thinking",
    undone: "Move undone. It is your turn.",
    reset: "Back to the start of the puzzle. The clock keeps running.",
    takeBack: "Tap the board to take the move back.",
    resumed: "You stopped here. It is your turn.",
    revealed: "Solution revealed. Study the idea and try the next one.",
    solvedBefore: "This puzzle is already solved.",
  },
  describeMove,
  intro,
  praise,
  solved,
  wrong,
  pieceHint,
  moveHint,
  takeBackHint: () => ({ mood: "thinking", text: "I took your move back: it does not solve the puzzle. Try another way, or ask for another hint." }),
  illegal(reason, piece, square) {
    if (reason === "in-check") return "Your king is in check. The move has to get the king out of check.";
    if (reason === "exposes-king") return "That move would leave your king in check.";
    return `${capital(the(piece))} cannot go to ${squareName(square)}.`;
  },
  reveal,
};
