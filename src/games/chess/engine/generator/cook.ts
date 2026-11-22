import { BALANCED_WITHIN, DEFENCE_MARGIN, type Recipe, UNIQUE_MARGIN, WIN_MARGIN } from "../config";
import { type Move, type Position, moveCaptured, movePromotion, moveTo } from "../position";
import { type Searcher, isMateScore, mateIn, matingMoves } from "../search";

/**
 * Turning a candidate position into a solution line.
 *
 * The rules follow the idea behind the Lichess puzzle generator (see
 * docs/chess/RESEARCH.md): at every solver move there must be one move that is
 * clearly better than all the others, and the opponent always answers with the
 * best defence. The thresholds are this engine's own, in its own centipawns.
 *
 * Every function takes the position with the solver to move and leaves it as
 * it found it.
 */

/** A first move the rules force is not a puzzle: the solver needs at least this many legal moves to choose from. */
const MIN_CHOICES = 3;

/**
 * A forced mate in exactly `moves` moves, as solver, opponent, solver, and so
 * on. Returns null when a faster mate exists or when the solver has a choice:
 * each solver move must be the only one that still mates in time. The last move
 * may have alternatives when the puzzle is longer than one move, since any mate
 * is accepted there.
 */
export function cookMate(position: Position, moves: number): Move[] | null {
  if (position.legalMoves().length < MIN_CHOICES) return null;
  // Cheap rejections first: two checking solutions, or a faster mate by checks, need no exact search.
  if (matingMoves(position, moves, true, 2).length !== 1) return null;
  if (moves > 1 && matingMoves(position, moves - 1, true, 1).length > 0) return null;
  if (moves > 1 && mateIn(position, moves - 1) !== 0) return null;
  const line: Move[] = [];
  let remaining = moves;
  let sound = true;
  for (;;) {
    const mates = matingMoves(position, remaining, false);
    if (mates.length === 0 || (mates.length > 1 && (remaining > 1 || moves === 1))) {
      sound = false;
      break;
    }
    line.push(mates[0]);
    position.make(mates[0]);
    if (remaining === 1) break;

    // The opponent picks the defence that lasts longest. Ties go to the first move generated, so the line is the same everywhere.
    let reply: Move = 0;
    let longest = -1;
    for (const candidate of position.legalMoves()) {
      position.make(candidate);
      const distance = mateIn(position, remaining - 1);
      position.unmake(candidate);
      if (distance > longest) {
        longest = distance;
        reply = candidate;
      }
    }
    if (reply === 0 || longest <= 0) {
      sound = false;
      break;
    }
    line.push(reply);
    position.make(reply);
    remaining = longest;
  }
  for (let index = line.length - 1; index >= 0; index--) position.unmake(line[index]);
  return sound && line.length === moves * 2 - 1 ? line : null;
}

/**
 * A line that wins material. `base` is the solver's score before the
 * opponent's mistake. Each solver move must win at least `WIN_MARGIN` over it,
 * and no other move may come within `UNIQUE_MARGIN` of the best one or win
 * `UNIQUE_MARGIN` by itself. The line stops as soon as that fails, and it only
 * counts when it has exactly `recipe.moves` solver moves and ends by taking
 * something, so the player sees what was won.
 */
export function cookAdvantage(position: Position, searcher: Searcher, base: number, recipe: Recipe): { line: Move[]; gain: number } | null {
  if (Math.abs(base) > BALANCED_WITHIN) return null;
  if (position.legalMoves().length < MIN_CHOICES) return null;
  const line: Move[] = [];
  let gain = 0;
  let solverMoves = 0;
  while (solverMoves < recipe.moves) {
    const best = searcher.best(position, recipe.depth);
    if (!best || isMateScore(best.score) || best.score < base + WIN_MARGIN) break;
    const threshold = Math.min(best.score - UNIQUE_MARGIN, base + UNIQUE_MARGIN);
    if (searcher.anotherMoveReaches(position, best.move, recipe.depth, threshold)) break;
    line.push(best.move);
    position.make(best.move);
    gain = best.score - base;
    solverMoves++;
    if (solverMoves === recipe.moves) break;
    const reply = searcher.best(position, recipe.depth - 1);
    if (!reply) break;
    line.push(reply.move);
    position.make(reply.move);
  }
  for (let index = line.length - 1; index >= 0; index--) position.unmake(line[index]);
  if (line.length % 2 === 0) line.pop();
  const last = line[line.length - 1];
  const cashesIn = last !== undefined && (moveCaptured(last) !== 0 || movePromotion(last) !== 0);
  return solverMoves === recipe.moves && line.length === recipe.moves * 2 - 1 && cashesIn ? { line, gain } : null;
}

/**
 * The one move that holds a threatened position: it keeps the balance within a
 * pawn, it is not itself a winning shot, and every other move loses at least
 * `DEFENCE_MARGIN`. Recaptures are left out, because taking back is never a
 * puzzle.
 */
export function cookDefence(position: Position, searcher: Searcher, base: number, recipe: Recipe, setup: Move): { line: Move[] } | null {
  if (Math.abs(base) > BALANCED_WITHIN) return null;
  if (position.legalMoves().length < MIN_CHOICES) return null;
  const best = searcher.best(position, recipe.depth);
  if (!best || isMateScore(best.score)) return null;
  if (best.score < base - 100 || best.score >= base + WIN_MARGIN) return null;
  if (moveCaptured(setup) !== 0 && moveTo(best.move) === moveTo(setup)) return null;
  if (searcher.anotherMoveReaches(position, best.move, recipe.depth, best.score - DEFENCE_MARGIN)) return null;
  return { line: [best.move] };
}
