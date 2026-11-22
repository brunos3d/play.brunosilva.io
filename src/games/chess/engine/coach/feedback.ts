import { type Move, type Position, moveCaptured, moveFrom, moveTo } from "../position";
import { Searcher, evaluate, matingMoves } from "../search";
import type { PuzzleKind } from "../types";

/**
 * Why a move is wrong, as data. The coach turns it into a sentence, and the
 * board shows `reply` when there is something to see. The analysis never names
 * the right move: it only describes what the wrong one allows.
 */
export type Feedback =
  /** The opponent now has a forced mate, starting with `reply`. */
  | { kind: "mated"; reply: Move; mateIn: number }
  /** `reply` wins material. `lost` is the piece type it takes, or 0 when the loss comes a move later. `moved` says it is the piece the player just moved. */
  | { kind: "loses-material"; reply: Move; lost: number; square: number; moved: boolean }
  /** Mate puzzle: a check that is answered, after which the attack is over. */
  | { kind: "check-answered"; reply: Move }
  /** Mate puzzle: a quiet move that gives the defender time. */
  | { kind: "too-slow"; reply: Move | null }
  /** The move still mates by force, only later than the solution does. */
  | { kind: "slower-mate" }
  /** The move takes something, but far less than the solution wins. `taken` is the piece type captured. */
  | { kind: "small-gain"; taken: number; reply: Move | null }
  /** Nothing is lost, but the chance is gone or the threat is still there. */
  | { kind: "misses"; reply: Move | null };

/** A reply has to win at least this much, in centipawns, for the coach to call it a loss. */
const LOSS_MARGIN = 200;
/** Plies searched after the wrong move, before captures. Enough to see a capture and the recapture around it. */
const REPLY_DEPTH = 2;
const NODE_BUDGET = 80_000;

/** True when the side to move is mated in at most `moves` moves whatever it plays. */
function losesToMate(position: Position, moves: number): boolean {
  const replies = position.legalMoves();
  if (replies.length === 0) return position.inCheck();
  for (const reply of replies) {
    position.make(reply);
    const mated = matingMoves(position, moves, false, 1).length > 0;
    position.unmake(reply);
    if (!mated) return false;
  }
  return true;
}

/**
 * Analyses a wrong move. `position` has the solver to move and is left as it
 * was. `mateIn` is the number of moves the solution still needs to mate, or 0
 * when the puzzle is not a mate.
 */
export function explainWrongMove(position: Position, move: Move, kind: PuzzleKind, mateIn: number): Feedback {
  const searcher = new Searcher(NODE_BUDGET);
  position.make(move);
  try {
    // What the player holds right after the move, before the opponent answers.
    const holding = -evaluate(position);
    const givesCheck = position.inCheck();

    for (let moves = 1; moves <= 2; moves++) {
      const mates = matingMoves(position, moves, false, 1);
      if (mates.length > 0) return { kind: "mated", reply: mates[0], mateIn: moves };
    }

    let best: ReturnType<Searcher["best"]> = null;
    try {
      best = searcher.best(position, REPLY_DEPTH);
    } catch {
      // Out of budget on a wild position. The coach then speaks in general terms.
    }
    const reply = best?.move ?? null;
    const keeping = best ? -best.score : holding;

    if (reply !== null && holding - keeping >= LOSS_MARGIN) {
      const lost = moveCaptured(reply);
      return { kind: "loses-material", reply, lost, square: moveTo(reply), moved: lost !== 0 && moveTo(reply) === moveTo(move) };
    }

    if (kind === "mate") {
      // Still a forced mate, just a longer one. Looked for two moves past the solution's length at most.
      if (mateIn > 0 && mateIn <= 2 && losesToMate(position, mateIn + 1)) return { kind: "slower-mate" };
      return givesCheck && reply !== null ? { kind: "check-answered", reply } : { kind: "too-slow", reply };
    }
    if (kind === "advantage" && moveCaptured(move) !== 0) return { kind: "small-gain", taken: moveCaptured(move), reply };
    return { kind: "misses", reply };
  } finally {
    position.unmake(move);
  }
}

/** Why a square cannot be the target of the piece on `from`, for the status line. */
export type IllegalReason = "in-check" | "exposes-king" | "unreachable";

/** Explains an attempt to move a piece of the side to move to a square it may not go to. */
export function explainIllegalMove(position: Position, from: number, to: number): IllegalReason {
  const pseudo: Move[] = [];
  position.pseudoMoves(pseudo);
  const reaches = pseudo.some((move) => moveFrom(move) === from && moveTo(move) === to);
  if (!reaches) return "unreachable";
  return position.inCheck() ? "in-check" : "exposes-king";
}
