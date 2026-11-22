import { BLACK, type Move, type Position, WHITE, moveCaptured, movePiece, movePromotion } from "./position";
import { KING_ENDGAME, KING_MIDDLEGAME, PIECE_VALUE } from "./tables";

/**
 * The small engine behind the puzzle generator and the coach.
 *
 * It is not built to play well. It is built to answer three questions about a
 * position a few moves deep, the same way on every machine: is there a forced
 * mate, how much material does the best line win, and is the best move the only
 * good one. Evaluation is material plus piece-square tables, and the search is
 * plain alpha-beta with a capture search at the leaves. Budgets are counted in
 * nodes, never in milliseconds, so a slow phone finds the same puzzle.
 */

export { PIECE_VALUE } from "./tables";

export const MATE = 30_000;
/** Scores beyond this are forced mates. The distance to mate is `MATE - |score|` plies. */
export const MATE_BOUND = MATE - 200;
const INFINITY = 32_000;

export const isMateScore = (score: number): boolean => Math.abs(score) >= MATE_BOUND;

/** Below this much non-pawn material per side the kings walk to the centre. */
const ENDGAME_MATERIAL = 1_300;

/** Material and placement, from the point of view of the side to move. The position keeps the totals, so this is a few additions. */
export function evaluate(position: Position): number {
  const endgame = position.pieceMaterial[WHITE] <= ENDGAME_MATERIAL && position.pieceMaterial[BLACK] <= ENDGAME_MATERIAL;
  const kingTable = endgame ? KING_ENDGAME : KING_MIDDLEGAME;
  const score = position.placement + kingTable[position.kings[WHITE] ^ 56] - kingTable[position.kings[BLACK]];
  return position.side === WHITE ? score : -score;
}

/** Captures of valuable pieces by cheap ones first, then promotions, then the rest in generation order. */
function orderScore(move: Move): number {
  const captured = moveCaptured(move);
  const promotion = movePromotion(move);
  return (captured ? 10 * PIECE_VALUE[captured] - PIECE_VALUE[movePiece(move)] / 10 + 10_000 : 0) + (promotion ? PIECE_VALUE[promotion] + 9_000 : 0);
}

function orderMoves(moves: Move[], first: Move): void {
  // Insertion sort: lists are short and a stable order keeps the search deterministic.
  const scores = moves.map((move) => (move === first ? 1_000_000 : orderScore(move)));
  for (let i = 1; i < moves.length; i++) {
    const move = moves[i];
    const score = scores[i];
    let j = i - 1;
    while (j >= 0 && scores[j] < score) {
      moves[j + 1] = moves[j];
      scores[j + 1] = scores[j];
      j--;
    }
    moves[j + 1] = move;
    scores[j + 1] = score;
  }
}

export class SearchBudgetExceeded extends Error {}

const MAX_PLY = 32;
/** How deep the capture search may go below the leaves. Checks are followed without limit up to this depth. */
const QUIESCENCE_PLIES = 6;
/** A capture is skipped when even winning the piece and this much placement cannot reach alpha. */
const DELTA_MARGIN = 150;

/**
 * One search context. It counts nodes across calls, so a caller can cap the
 * work of a whole generation attempt, and it keeps the principal variation of
 * the last search.
 */
export class Searcher {
  nodes = 0;
  private readonly pv: Move[][] = Array.from({ length: MAX_PLY + 1 }, () => []);

  constructor(private readonly nodeLimit = Number.POSITIVE_INFINITY) {}

  private visit(): void {
    if (++this.nodes > this.nodeLimit) throw new SearchBudgetExceeded("node budget exceeded");
  }

  /**
   * Captures only, until the position is quiet. In check it tries every
   * evasion. Two kinds of capture are skipped because they almost never change
   * the result and they are most of the tree: taking a cheaper piece that a
   * pawn defends, and taking something too small to bring the score back up to
   * alpha.
   */
  private quiesce(position: Position, alpha: number, beta: number, ply: number, depth: number): number {
    this.visit();
    const inCheck = position.inCheck();
    if (inCheck) {
      const evasions = position.legalMoves(false, true);
      if (evasions.length === 0) return -MATE + ply;
      if (depth <= 0 || ply >= MAX_PLY) return evaluate(position);
      orderMoves(evasions, 0);
      let best = -INFINITY;
      for (const move of evasions) {
        position.make(move);
        const score = -this.quiesce(position, -beta, -alpha, ply + 1, depth - 1);
        position.unmake(move);
        if (score > best) best = score;
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
      }
      return best;
    }

    const standing = evaluate(position);
    if (depth <= 0 || ply >= MAX_PLY) return standing;
    if (standing >= beta) return standing;
    if (standing > alpha) alpha = standing;
    let best = standing;
    const captures = position.legalMoves(true, false);
    orderMoves(captures, 0);
    const enemy = (position.side ^ 1) as 0 | 1;
    for (const move of captures) {
      const victim = PIECE_VALUE[moveCaptured(move)] + (movePromotion(move) ? PIECE_VALUE[movePromotion(move)] - PIECE_VALUE[1] : 0);
      if (standing + victim + DELTA_MARGIN <= alpha) continue;
      if (victim < PIECE_VALUE[movePiece(move)] && position.isAttackedByPawn((move >> 6) & 63, enemy)) continue;
      position.make(move);
      const score = -this.quiesce(position, -beta, -alpha, ply + 1, depth - 1);
      position.unmake(move);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  private alphaBeta(position: Position, depth: number, alpha: number, beta: number, ply: number): number {
    const line = this.pv[ply];
    line.length = 0;
    const inCheck = position.inCheck();
    // A check is answered before the horizon, or the search would stop in the middle of a forced line.
    if (inCheck && ply < MAX_PLY - QUIESCENCE_PLIES) depth = Math.max(depth, 1);
    if (depth <= 0) return this.quiesce(position, alpha, beta, ply, QUIESCENCE_PLIES);
    this.visit();

    const moves = position.legalMoves(false, inCheck);
    if (moves.length === 0) return inCheck ? -MATE + ply : 0;
    if (position.halfmove >= 100) return 0;
    orderMoves(moves, 0);

    let best = -INFINITY;
    for (const move of moves) {
      position.make(move);
      const score = -this.alphaBeta(position, depth - 1, -beta, -alpha, ply + 1);
      position.unmake(move);
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          const below = this.pv[ply + 1];
          line.length = 0;
          line.push(move);
          for (const next of below) line.push(next);
        }
      }
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Score of the position for the side to move, searching `depth` plies and then captures. */
  search(position: Position, depth: number, alpha = -INFINITY, beta = INFINITY): number {
    return this.alphaBeta(position, depth, alpha, beta, 0);
  }

  /** Best move, its score and the line the search expects, or null when there is no legal move. */
  best(position: Position, depth: number): { move: Move; score: number; line: Move[] } | null {
    const score = this.alphaBeta(position, depth, -INFINITY, INFINITY, 0);
    const line = [...this.pv[0]];
    return line.length === 0 ? null : { move: line[0], score, line };
  }

  /** Score of one move for the side making it, after `depth` plies in total. */
  scoreMove(position: Position, move: Move, depth: number, alpha = -INFINITY, beta = INFINITY): number {
    position.make(move);
    try {
      return -this.alphaBeta(position, depth - 1, -beta, -alpha, 1);
    } finally {
      position.unmake(move);
    }
  }

  /** The line the last `scoreMove` expected after the move itself. */
  replyLine(): Move[] {
    return [...this.pv[1]];
  }

  /**
   * Exact score of every legal move, best first. Each move gets a full window,
   * which costs more than one search but is what "is this the only good move"
   * needs. Ties keep generation order.
   */
  rank(position: Position, depth: number): { move: Move; score: number }[] {
    const ranked = position.legalMoves().map((move) => ({ move, score: this.scoreMove(position, move, depth) }));
    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * True when some move other than `except` scores at least `threshold`. A
   * null-window search per move: far cheaper than ranking them all, and it is
   * all the uniqueness test needs to know.
   */
  anotherMoveReaches(position: Position, except: Move, depth: number, threshold: number): boolean {
    const moves = position.legalMoves();
    orderMoves(moves, 0);
    for (const move of moves) {
      if (move === except) continue;
      if (this.scoreMove(position, move, depth, threshold - 1, threshold) >= threshold) return true;
    }
    return false;
  }
}

/**
 * First moves that force mate in at most `moves` moves.
 *
 * With `checksOnly`, the mating side only tries checks. That misses mates that
 * start quietly, but it is what makes scanning a whole game for mates cheap.
 * The defender always gets every legal reply. Without `checksOnly` the result
 * is exact, and that form verifies a candidate before it becomes a puzzle.
 */
export function matingMoves(position: Position, moves: number, checksOnly: boolean, limit = Number.POSITIVE_INFINITY): Move[] {
  return findMates(position, moves, checksOnly, limit, []);
}

/**
 * `killers[n]` is the last defence that refuted an attack with `n` moves left.
 * The same defence usually refutes the next try as well, so it goes first. This
 * only changes the order replies are tried in, never the answer.
 */
function findMates(position: Position, moves: number, checksOnly: boolean, limit: number, killers: Move[]): Move[] {
  const found: Move[] = [];
  // The last move has to be a check whatever the mode, so geometry can discard most moves unplayed.
  const mustCheck = checksOnly || moves === 1;
  for (const move of position.legalMoves()) {
    if (mustCheck && !position.mayGiveCheck(move)) continue;
    position.make(move);
    const check = position.inCheck();
    let mates = false;
    if (check || !mustCheck) {
      if (moves === 1) mates = !position.hasLegalMove();
      else mates = everyReplyLoses(position, moves - 1, checksOnly, check, killers);
    }
    position.unmake(move);
    if (mates) {
      found.push(move);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/** The side to move is mated at once, or loses to a forced mate in `moves` moves whatever it plays. Stalemate counts as an escape. */
function everyReplyLoses(position: Position, moves: number, checksOnly: boolean, inCheck: boolean, killers: Move[]): boolean {
  const replies = position.legalMoves(false, inCheck);
  if (replies.length === 0) return inCheck;
  const killer = killers[moves] ?? 0;
  const index = killer === 0 ? -1 : replies.indexOf(killer);
  if (index > 0) {
    replies[index] = replies[0];
    replies[0] = killer;
  }
  for (const reply of replies) {
    position.make(reply);
    const mated = findMates(position, moves, checksOnly, 1, killers).length > 0;
    position.unmake(reply);
    if (!mated) {
      killers[moves] = reply;
      return false;
    }
  }
  return true;
}

/** Fewest moves in which the side to move forces mate, up to `maxMoves`, or 0 when it cannot. Exact, so only use it on a few positions. */
export function mateIn(position: Position, maxMoves: number): number {
  for (let moves = 1; moves <= maxMoves; moves++) {
    if (matingMoves(position, moves, false, 1).length > 0) return moves;
  }
  return 0;
}

export const isCheckmate = (position: Position): boolean => position.inCheck() && !position.hasLegalMove();
export const isStalemate = (position: Position): boolean => !position.inCheck() && !position.hasLegalMove();
