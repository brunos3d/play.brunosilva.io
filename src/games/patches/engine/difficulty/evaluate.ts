import { type CandidateSet, buildCandidates } from "../solver/candidates";
import { type LogicResult, solveWithLogic } from "../solver/logic";
import { type SolveResult, solve } from "../solver/search";
import type { Difficulty, PuzzleShape, QualityMetrics } from "../types";
import { tierForScore } from "./config";

export type DifficultyReport = {
  score: number;
  tier: Difficulty;
  metrics: QualityMetrics;
  /** Score contributions, for the debug panel and for tuning. */
  breakdown: Record<"size" | "ambiguity" | "unknowns" | "technique" | "opening" | "depth" | "guessing", number>;
};

/** Weights of the score terms. Each term is normalized to 0..1 before weighting. */
const WEIGHTS = {
  size: 12,
  ambiguity: 22,
  unknowns: 14,
  technique: 22,
  opening: 14,
  depth: 16,
  guessing: 25,
} as const;

const SMALLEST_BOARD_CELLS = 25;
const LARGEST_BOARD_CELLS = 100;
/** log2 of the average options per clue at which ambiguity counts as maximal. */
const AMBIGUITY_CEILING_BITS = 5;
const STEP_COST = { "clue-single": 1, "cell-single": 2, search: 6 } as const;
const ELIMINATION_SURCHARGE = 3;
const MAX_STEP_COST = STEP_COST.search + ELIMINATION_SURCHARGE;
const DEPTH_CEILING_WAVES = 8;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export type EvaluateInputs = {
  candidates?: CandidateSet;
  search?: SolveResult;
  logic?: LogicResult;
};

/**
 * Scores a puzzle from 0 to about 100 by solving it the way a person would and
 * looking at what that took. Board size is one input among seven, so a small
 * board full of numberless clues can outrank a large, fully labelled one.
 */
export function evaluateDifficulty(puzzle: PuzzleShape, inputs: EvaluateInputs = {}): DifficultyReport {
  const set = inputs.candidates ?? buildCandidates(puzzle);
  const search = inputs.search ?? solve(puzzle, { candidates: set, maxSolutions: 2 });
  const logic = inputs.logic ?? solveWithLogic(puzzle, { candidates: set });

  const clueCount = Math.max(1, puzzle.clues.length);
  const cells = puzzle.width * puzzle.height;
  const candidateCount = set.candidates.length;
  const averageCandidateCount = candidateCount / clueCount;
  const unknownClueRatio = puzzle.clues.filter((clue) => clue.area === undefined).length / clueCount;

  const forcedMoveCount = logic.steps.filter((step) => step.wave === 1 && !step.neededElimination).length;
  const advancedStepCount = logic.steps.filter((step) => step.neededElimination && step.technique !== "search").length;
  const guessCount = logic.steps.filter((step) => step.technique === "search").length;
  const stepCost = logic.steps.reduce(
    (sum, step) => sum + STEP_COST[step.technique] + (step.neededElimination && step.technique !== "search" ? ELIMINATION_SURCHARGE : 0),
    0,
  );

  const breakdown = {
    size: WEIGHTS.size * clamp01((cells - SMALLEST_BOARD_CELLS) / (LARGEST_BOARD_CELLS - SMALLEST_BOARD_CELLS)),
    ambiguity: WEIGHTS.ambiguity * clamp01(Math.log2(Math.max(1, averageCandidateCount)) / AMBIGUITY_CEILING_BITS),
    unknowns: WEIGHTS.unknowns * unknownClueRatio,
    technique: WEIGHTS.technique * clamp01((stepCost / clueCount - STEP_COST["clue-single"]) / (MAX_STEP_COST - STEP_COST["clue-single"]) * 2),
    opening: WEIGHTS.opening * (1 - forcedMoveCount / clueCount),
    depth: WEIGHTS.depth * clamp01((logic.waves - 1) / (DEPTH_CEILING_WAVES - 1)),
    guessing: WEIGHTS.guessing * clamp01(guessCount / 2),
  };
  const score = Math.round(Object.values(breakdown).reduce((sum, part) => sum + part, 0) * 10) / 10;

  return {
    score,
    tier: tierForScore(score),
    breakdown,
    metrics: {
      solutionCount: search.solutionCount,
      candidateCount,
      averageCandidateCount: Math.round(averageCandidateCount * 100) / 100,
      forcedMoveCount,
      maximumBranchingFactor: search.maximumBranchingFactor,
      deductionDepth: logic.waves,
      advancedStepCount,
      guessCount,
      clueDensity: Math.round((puzzle.clues.length / cells) * 1000) / 1000,
      unknownClueRatio: Math.round(unknownClueRatio * 1000) / 1000,
      solverNodes: search.nodes,
    },
  };
}
