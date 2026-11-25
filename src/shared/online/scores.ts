import { GAME_IDS } from "@/games/registry";
import { type Difficulty, isDifficulty } from "@/shared/engine/difficulty";
import { isDateKey } from "@/shared/engine/pacific-time";
import type { ScoreSubmission } from "./types";

/**
 * How a finished daily puzzle turns into points. The same numbers are shown to
 * the player, so the rule has to be simple enough to say in one sentence:
 * 100 points for solving, minus 10 per hint, plus up to 50 for speed.
 *
 * A revealed or lost puzzle is never submitted, so it scores nothing.
 */
export const SOLVE_POINTS = 100;
export const HINT_COST = 10;
/** A solve with many hints still counts for something. */
export const MIN_SOLVE_POINTS = 20;
export const SPEED_BONUS = 50;

/** Solving within this time earns the whole speed bonus. Slower solves earn a share of it: twice the time, half the bonus. */
export const PAR_MS: Record<Difficulty, number> = { easy: 60_000, medium: 120_000, hard: 240_000, expert: 360_000 };

/** In a ranking by time, each hint counts as this much time. The same cost as in a challenge room. */
export const RANKING_HINT_MS = 30_000;

export function scorePoints(difficulty: Difficulty, elapsedMs: number, hints: number): number {
  const solve = Math.max(MIN_SOLVE_POINTS, SOLVE_POINTS - HINT_COST * hints);
  const speed = Math.round(SPEED_BONUS * Math.min(1, PAR_MS[difficulty] / Math.max(elapsedMs, 1)));
  return solve + speed;
}

const isCount = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;

/** Checks a submission's shape. The date is checked against the server's calendar by the caller. */
export function parseScore(body: Record<string, unknown>): ScoreSubmission | null {
  if (typeof body.game !== "string" || !(GAME_IDS as readonly string[]).includes(body.game)) return null;
  if (typeof body.date !== "string" || !isDateKey(body.date) || !isDifficulty(body.difficulty)) return null;
  if (!isCount(body.number, 100_000) || !isCount(body.size, 64) || !isCount(body.hintsUsed, 500) || !isCount(body.mistakes, 10_000)) return null;
  // A puzzle cannot be solved in under a second, and a clock left running for more than a day says nothing about the solve.
  if (!isCount(body.elapsedMs, 24 * 60 * 60 * 1000) || body.elapsedMs < 1_000) return null;
  if (body.variant !== undefined && (typeof body.variant !== "string" || !/^[a-z-]{2,8}$/.test(body.variant))) return null;
  return {
    game: body.game as ScoreSubmission["game"],
    ...(body.variant ? { variant: body.variant } : {}),
    date: body.date,
    number: body.number,
    difficulty: body.difficulty,
    size: body.size,
    elapsedMs: body.elapsedMs,
    hintsUsed: body.hintsUsed,
    mistakes: body.mistakes,
  };
}
