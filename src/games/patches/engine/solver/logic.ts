import type { PuzzleShape } from "../types";
import { type CandidateSet, buildCandidates, findCandidate, masksOverlap } from "./candidates";
import { type FixedPlacement, solve } from "./search";

/**
 * How a patch became certain.
 * - clue-single: the clue has one rectangle left.
 * - cell-single: one cell can be reached by a single rectangle.
 * - search: logic ran dry and the exact-cover search supplied the patch.
 */
export type Technique = "clue-single" | "cell-single" | "search";

export type LogicStep = {
  technique: Technique;
  clueIndex: number;
  candidateIndex: number;
  /** 1-based round of deduction in which the patch became available. */
  wave: number;
  /** True when rectangles had to be ruled out by lookahead before this patch was forced. */
  neededElimination: boolean;
  /** For cell-single: the cell only this rectangle can reach. */
  forcedCell?: number;
  /** Live rectangles the clue had when the board was empty. */
  initialOptions: number;
};

export type LogicResult = {
  steps: LogicStep[];
  /** Every clue got a patch. */
  solved: boolean;
  /** A clue or cell ran out of rectangles: the starting board is wrong. */
  contradiction: boolean;
  waves: number;
  eliminatedCandidates: number;
};

export type LogicOptions = {
  candidates?: CandidateSet;
  fixed?: readonly FixedPlacement[];
  /** Stop after this many placement steps. Hints only need the first one. */
  maxSteps?: number;
  /** When false, stop instead of falling back to search. */
  allowSearch?: boolean;
};

/**
 * Solves the way a person would, and records how each patch was found.
 *
 * Each round first places every patch that is already forced. When nothing is
 * forced, it rules out rectangles by one-step lookahead: a rectangle is dead if
 * placing it would leave some cell, or some clue, with no rectangle at all.
 * This also covers the "cells shared by all options of a clue" argument, since
 * a rival rectangle on such a cell leaves that clue with nothing. Only when
 * lookahead makes no progress does the search step in.
 */
export function solveWithLogic(puzzle: PuzzleShape, options: LogicOptions = {}): LogicResult {
  const set = options.candidates ?? buildCandidates(puzzle);
  const { candidates, byClue, byCell, cellCount, words } = set;
  const clueCount = puzzle.clues.length;
  const maxSteps = options.maxSteps ?? Infinity;
  const allowSearch = options.allowSearch ?? true;

  const alive = new Uint8Array(candidates.length).fill(1);
  const placedBy = new Int32Array(clueCount).fill(-1);
  const occupied = new Int32Array(words);
  const initialOptions = byClue.map((list) => list.length);
  const result: LogicResult = { steps: [], solved: false, contradiction: false, waves: 0, eliminatedCandidates: 0 };

  const isCovered = (cell: number): boolean => (occupied[cell >>> 5] & (1 << (cell & 31))) !== 0;

  const place = (candidateIndex: number): void => {
    const chosen = candidates[candidateIndex];
    placedBy[chosen.clueIndex] = candidateIndex;
    for (let w = 0; w < words; w++) occupied[w] |= chosen.mask[w];
    for (const other of byClue[chosen.clueIndex]) alive[other] = 0;
    for (const cell of chosen.cells) {
      for (const other of byCell[cell]) alive[other] = 0;
    }
  };

  for (const fixed of options.fixed ?? []) {
    const candidate = findCandidate(set, fixed.clueIndex, fixed.rect);
    if (!candidate || !alive[candidate.index]) {
      result.contradiction = true;
      return result;
    }
    place(candidate.index);
  }

  const liveForClue = (clueIndex: number): number[] => byClue[clueIndex].filter((index) => alive[index]);
  const liveForCell = (cell: number): number[] => byCell[cell].filter((index) => alive[index]);
  const allPlaced = (): boolean => placedBy.every((index) => index >= 0);

  /** Forced patches available right now, at most one per clue. */
  const findForced = (): Map<number, Omit<LogicStep, "wave" | "neededElimination" | "initialOptions">> | null => {
    const forced = new Map<number, Omit<LogicStep, "wave" | "neededElimination" | "initialOptions">>();
    for (let clueIndex = 0; clueIndex < clueCount; clueIndex++) {
      if (placedBy[clueIndex] >= 0) continue;
      const live = liveForClue(clueIndex);
      if (live.length === 0) return null;
      if (live.length === 1) forced.set(clueIndex, { technique: "clue-single", clueIndex, candidateIndex: live[0] });
    }
    for (let cell = 0; cell < cellCount; cell++) {
      if (isCovered(cell)) continue;
      const live = liveForCell(cell);
      if (live.length === 0) return null;
      if (live.length === 1) {
        const clueIndex = candidates[live[0]].clueIndex;
        if (!forced.has(clueIndex)) {
          forced.set(clueIndex, { technique: "cell-single", clueIndex, candidateIndex: live[0], forcedCell: cell });
        }
      }
    }
    return forced;
  };

  /**
   * One-step lookahead. Returns how many rectangles it ruled out. Verdicts are
   * collected against a frozen board and applied afterwards, so the outcome of
   * a pass does not depend on the order clues are listed in.
   */
  const eliminate = (): number => {
    const doomed: number[] = [];
    for (const candidate of candidates) {
      if (!alive[candidate.index]) continue;
      let strands = false;
      for (let cell = 0; cell < cellCount && !strands; cell++) {
        if (isCovered(cell) || (candidate.mask[cell >>> 5] & (1 << (cell & 31))) !== 0) continue;
        let reachable = false;
        for (const other of byCell[cell]) {
          if (!alive[other]) continue;
          const rival = candidates[other];
          if (rival.clueIndex === candidate.clueIndex) continue;
          if (!masksOverlap(rival.mask, candidate.mask)) {
            reachable = true;
            break;
          }
        }
        if (!reachable) strands = true;
      }
      if (strands) doomed.push(candidate.index);
    }
    for (const index of doomed) alive[index] = 0;
    return doomed.length;
  };

  let eliminationSinceLastPlacement = false;

  while (!allPlaced() && result.steps.length < maxSteps) {
    const forced = findForced();
    if (forced === null) {
      result.contradiction = true;
      return result;
    }

    if (forced.size > 0) {
      result.waves++;
      for (const step of forced.values()) {
        if (result.steps.length >= maxSteps) break;
        if (!alive[step.candidateIndex]) {
          // Two forced patches collide, so the starting board cannot be completed.
          result.contradiction = true;
          return result;
        }
        place(step.candidateIndex);
        result.steps.push({
          ...step,
          wave: result.waves,
          neededElimination: eliminationSinceLastPlacement,
          initialOptions: initialOptions[step.clueIndex],
        });
      }
      eliminationSinceLastPlacement = false;
      continue;
    }

    const removed = eliminate();
    if (removed > 0) {
      result.eliminatedCandidates += removed;
      eliminationSinceLastPlacement = true;
      continue;
    }

    if (!allowSearch) return result;

    // Logic is stuck. Ask the search for a completion and take the patch of the
    // most constrained clue from it.
    const fixed: FixedPlacement[] = [];
    placedBy.forEach((candidateIndex, clueIndex) => {
      if (candidateIndex >= 0) fixed.push({ clueIndex, rect: candidates[candidateIndex].rect });
    });
    const searched = solve(puzzle, { candidates: set, fixed, maxSolutions: 1 });
    if (searched.solutionCount === 0) {
      result.contradiction = true;
      return result;
    }
    let target = -1;
    let fewest = Infinity;
    for (let clueIndex = 0; clueIndex < clueCount; clueIndex++) {
      if (placedBy[clueIndex] >= 0) continue;
      const live = liveForClue(clueIndex).length;
      if (live < fewest) {
        fewest = live;
        target = clueIndex;
      }
    }
    const candidate = findCandidate(set, target, searched.solutions[0][target]);
    if (!candidate) {
      result.contradiction = true;
      return result;
    }
    result.waves++;
    place(candidate.index);
    result.steps.push({
      technique: "search",
      clueIndex: target,
      candidateIndex: candidate.index,
      wave: result.waves,
      neededElimination: true,
      initialOptions: initialOptions[target],
    });
    eliminationSinceLastPlacement = false;
  }

  result.solved = allPlaced();
  return result;
}
