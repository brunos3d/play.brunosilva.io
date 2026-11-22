import type { Rng } from "@/shared/engine/prng";
import { BALANCED_WITHIN, type ChessTier, MAX_GAME_PLIES, POLICY_NOISE, type Recipe, WIN_MARGIN } from "../config";
import { type Move, Position, START_FEN, moveCaptured, moveFrom, moveTo } from "../position";
import { type Searcher, matingMoves } from "../search";
import type { PuzzleKind } from "../types";
import { cookAdvantage, cookDefence, cookMate } from "./cook";
import { hasSacrifice } from "./themes";

/** A puzzle as the miner finds it, still in engine moves. */
export type Mined = {
  /** Position before the opponent's move. */
  fen: string;
  setup: Move;
  line: Move[];
  kind: PuzzleKind;
  mateIn: number;
  gain: number;
  ply: number;
};

type Scored = { move: Move; value: number };

/** Fewer pieces than this and the position is a bare endgame, where a mate or a capture is no longer a tactic. */
const MIN_PIECES = 10;
/** Plausible opponent moves tried per position for the multi-move recipes. */
const PROBES_PER_PLY = 5;
/** Losing moves tried per position for the one-move win. */
const BLUNDERS_PER_PLY = 4;

function countPieces(position: Position): number {
  let count = 0;
  for (let square = 0; square < 64; square++) if (position.board[square] !== 0) count++;
  return count;
}

/**
 * Plays one game from the starting position and stops at the first move that
 * makes a puzzle for the given recipe.
 *
 * Both sides follow the same policy: take the move with the best score after
 * captures are resolved, plus a little seeded noise. That is a player who never
 * leaves a piece hanging in one move and never sees a two-move tactic, which is
 * exactly the kind of game puzzles come from. Positions are therefore always
 * reachable from the start by legal play.
 *
 * From `startPly` on, every position is probed: is there a move for the side to
 * play that the other side can punish in the way the recipe asks for? If so,
 * that move becomes the puzzle's opening move. If not, the game goes on with
 * the policy move, so it stays balanced.
 */
export function mineGame(rng: Rng, tier: ChessTier, recipe: Recipe, searcher: Searcher): Mined | null {
  const position = Position.fromFen(START_FEN);
  const startPly = rng.range(tier.startPly[0], tier.startPly[1]);
  /** Last move of each side, to stop pieces from shuffling back and forth. */
  const lastMove: [Move, Move] = [0, 0];

  for (let ply = 0; ply < MAX_GAME_PLIES; ply++) {
    const moves = position.legalMoves();
    if (moves.length === 0 || position.halfmove >= 60) return null;
    if (ply >= startPly && countPieces(position) < MIN_PIECES) return null;

    const scored: Scored[] = moves.map((move) => ({ move, value: searcher.scoreMove(position, move, 1) }));
    // Stable sort, best first. The noise only decides the move played, the probes see the plain scores.
    scored.sort((a, b) => b.value - a.value);

    if (ply >= startPly) {
      const found = probe(position, scored, recipe, searcher, rng);
      if (found) return { ...found, fen: position.toFen(), ply };
    }

    const previous = lastMove[position.side];
    let chosen = scored[0].move;
    let chosenValue = Number.NEGATIVE_INFINITY;
    for (const { move, value } of scored) {
      const undoes = previous !== 0 && moveFrom(move) === moveTo(previous) && moveTo(move) === moveFrom(previous);
      const noisy = value + rng.int(POLICY_NOISE * 2 + 1) - POLICY_NOISE - (undoes ? 60 : 0);
      if (noisy > chosenValue) {
        chosenValue = noisy;
        chosen = move;
      }
    }
    lastMove[position.side] = chosen;
    position.make(chosen);
  }
  return null;
}

type Found = Omit<Mined, "fen" | "ply">;

function probe(position: Position, scored: readonly Scored[], recipe: Recipe, searcher: Searcher, rng: Rng): Found | null {
  if (recipe.kind === "mate") return probeMate(position, scored, recipe);
  // The solver's score if the opponent plays its best move instead of the mistake.
  const base = -scored[0].value;
  if (Math.abs(base) > BALANCED_WITHIN) return null;
  return recipe.kind === "win" ? probeWin(position, scored, recipe, searcher, rng, base) : probeDefence(position, scored, recipe, searcher, base);
}

/** Tries every legal move, the most natural ones first, and keeps the first that allows a forced mate with one solution. */
function probeMate(position: Position, scored: readonly Scored[], recipe: Recipe): Found | null {
  for (const { move } of scored) {
    position.make(move);
    // Checks only: cheap enough to run on every move of every position. cookMate then proves the mate exactly.
    let line = matingMoves(position, recipe.moves, true, 1).length > 0 ? cookMate(position, recipe.moves) : null;
    if (line && recipe.minChecks !== undefined && countChecks(position) < recipe.minChecks && !hasSacrifice(line)) line = null;
    position.unmake(move);
    if (line) return { setup: move, line, kind: "mate", mateIn: recipe.moves, gain: 0 };
  }
  return null;
}

function countChecks(position: Position): number {
  let checks = 0;
  for (const move of position.legalMoves()) {
    if (!position.mayGiveCheck(move)) continue;
    position.make(move);
    if (position.inCheck()) checks++;
    position.unmake(move);
  }
  return checks;
}

function probeWin(position: Position, scored: readonly Scored[], recipe: Recipe, searcher: Searcher, rng: Rng, base: number): Found | null {
  const target = base + WIN_MARGIN;
  let candidates: Move[];
  if (recipe.moves === 1) {
    // Moves that lose material at once. They are all mistakes, so the seed picks among them.
    candidates = rng.shuffle(scored.filter(({ value }) => -value >= target).map(({ move }) => move)).slice(0, BLUNDERS_PER_PLY);
  } else {
    // Moves that look fine one ply deep and lose to something longer: the natural mistakes of this policy.
    candidates = scored.filter(({ value }) => -value < base + WIN_MARGIN / 2).slice(0, PROBES_PER_PLY).map(({ move }) => move);
  }
  for (const move of candidates) {
    position.make(move);
    // A null-window search answers "is there a win at all" for a fraction of the full analysis. The line ends on a
    // capture, which the capture search plays, so two plies fewer than the line are enough to see it.
    const promising = recipe.moves === 1 || searcher.search(position, recipe.moves * 2 - 2, target - 1, target) >= target;
    const cooked = promising ? cookAdvantage(position, searcher, base, recipe) : null;
    position.unmake(move);
    if (cooked) return { setup: move, line: cooked.line, kind: "advantage", mateIn: 0, gain: cooked.gain };
  }
  return null;
}

/** Moves sampled to decide whether a position is under threat at all. */
const DEFENCE_SAMPLES = 3;

/** The opponent plays the move the game would play anyway. If it happens to leave the solver one good answer, that is a defence puzzle. */
function probeDefence(position: Position, scored: readonly Scored[], recipe: Recipe, searcher: Searcher, base: number): Found | null {
  const move = scored[0].move;
  if (moveCaptured(move) !== 0) return null;
  position.make(move);
  // With one saving move, at most one of any three moves holds. Three shallow searches rule out most positions before the full analysis.
  const sample = position.legalMoves().slice(0, DEFENCE_SAMPLES);
  const holds = base - BALANCED_WITHIN;
  const threatened = sample.length === DEFENCE_SAMPLES && sample.filter((reply) => searcher.scoreMove(position, reply, 2, holds - 1, holds) >= holds).length <= 1;
  const cooked = threatened ? cookDefence(position, searcher, base, recipe, move) : null;
  position.unmake(move);
  return cooked ? { setup: move, line: cooked.line, kind: "defence", mateIn: 0, gain: 0 } : null;
}
