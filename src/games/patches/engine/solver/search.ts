import type { PuzzleShape, Rect } from "../types";
import { type CandidateSet, buildCandidates, findCandidate } from "./candidates";

export type FixedPlacement = { clueIndex: number; rect: Rect };

export type SolveOptions = {
  /** Stop after this many solutions. 2 is enough to decide uniqueness. */
  maxSolutions?: number;
  /** Regions that must be part of every solution, for example the player's board. */
  fixed?: readonly FixedPlacement[];
  /** Reuse a candidate set built earlier for the same puzzle. */
  candidates?: CandidateSet;
  /** Safety valve for adversarial hand-made boards. */
  maxNodes?: number;
};

export type SolveResult = {
  /** One entry per solution. Each holds one rectangle per clue, in clue order. */
  solutions: Rect[][];
  solutionCount: number;
  /** Exactly one solution, and the search was not cut short. */
  unique: boolean;
  nodes: number;
  maximumBranchingFactor: number;
  /** True when `maxNodes` stopped the search before it finished. */
  aborted: boolean;
};

const DEFAULT_MAX_SOLUTIONS = 2;
const DEFAULT_MAX_NODES = 5_000_000;

/**
 * Exact-cover search over candidate rectangles.
 *
 * Every cell must end up inside exactly one rectangle and every clue owns one.
 * At each node the solver picks the uncovered cell with the fewest live
 * rectangles (minimum remaining values) and branches on those. A cell with no
 * live rectangle kills the branch at once. Because a clue cell can only be
 * covered by its own clue's rectangles, the same rule also catches clues that
 * have run out of options.
 */
export function solve(puzzle: PuzzleShape, options: SolveOptions = {}): SolveResult {
  const set = options.candidates ?? buildCandidates(puzzle);
  const maxSolutions = options.maxSolutions ?? DEFAULT_MAX_SOLUTIONS;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const { candidates, byCell, cellCount, words } = set;

  const result: SolveResult = {
    solutions: [],
    solutionCount: 0,
    unique: false,
    nodes: 0,
    maximumBranchingFactor: 0,
    aborted: false,
  };

  const occupied = new Int32Array(words);
  const clueUsed = new Uint8Array(puzzle.clues.length);
  const chosen = new Int32Array(puzzle.clues.length).fill(-1);
  let covered = 0;

  const isLive = (index: number): boolean => {
    const candidate = candidates[index];
    if (clueUsed[candidate.clueIndex]) return false;
    const mask = candidate.mask;
    for (let w = 0; w < words; w++) {
      if ((mask[w] & occupied[w]) !== 0) return false;
    }
    return true;
  };

  const place = (index: number): void => {
    const candidate = candidates[index];
    for (let w = 0; w < words; w++) occupied[w] |= candidate.mask[w];
    clueUsed[candidate.clueIndex] = 1;
    chosen[candidate.clueIndex] = index;
    covered += candidate.cells.length;
  };

  const unplace = (index: number): void => {
    const candidate = candidates[index];
    for (let w = 0; w < words; w++) occupied[w] &= ~candidate.mask[w];
    clueUsed[candidate.clueIndex] = 0;
    chosen[candidate.clueIndex] = -1;
    covered -= candidate.cells.length;
  };

  for (const fixed of options.fixed ?? []) {
    const candidate = findCandidate(set, fixed.clueIndex, fixed.rect);
    if (!candidate || !isLive(candidate.index)) return result;
    place(candidate.index);
  }

  const search = (): void => {
    if (result.solutionCount >= maxSolutions || result.aborted) return;
    if (++result.nodes > maxNodes) {
      result.aborted = true;
      return;
    }
    if (covered === cellCount) {
      result.solutionCount++;
      result.solutions.push(Array.from(chosen, (index) => ({ ...candidates[index].rect })));
      return;
    }

    let bestCount = Infinity;
    let bestOptions: number[] = [];
    for (let cell = 0; cell < cellCount && bestCount > 1; cell++) {
      if ((occupied[cell >>> 5] & (1 << (cell & 31))) !== 0) continue;
      const options: number[] = [];
      for (const index of byCell[cell]) {
        if (isLive(index)) {
          options.push(index);
          if (options.length >= bestCount) break;
        }
      }
      if (options.length < bestCount) {
        bestCount = options.length;
        bestOptions = options;
        if (bestCount === 0) return;
      }
    }

    if (bestCount > result.maximumBranchingFactor) result.maximumBranchingFactor = bestCount;
    for (const index of bestOptions) {
      place(index);
      search();
      unplace(index);
      if (result.solutionCount >= maxSolutions || result.aborted) return;
    }
  };

  search();
  result.unique = result.solutionCount === 1 && !result.aborted;
  return result;
}

/** Convenience wrapper with the name used across docs and tools. */
export function solvePuzzle(puzzle: PuzzleShape, options: SolveOptions = {}): SolveResult {
  return solve(puzzle, options);
}

export function countSolutions(puzzle: PuzzleShape, limit = DEFAULT_MAX_SOLUTIONS): number {
  return solve(puzzle, { maxSolutions: limit }).solutionCount;
}
