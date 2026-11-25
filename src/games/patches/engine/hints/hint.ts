import { rectCells, rectEquals } from "../board/geometry";
import { regionRect } from "../regions/region";
import { buildCandidates, findCandidate } from "../solver/candidates";
import { type Technique, solveWithLogic } from "../solver/logic";
import { type FixedPlacement, solve } from "../solver/search";
import type { CellCoordinate, Clue, PuzzleShape, Rect, Region } from "../types";

/**
 * Why a placed patch has to go.
 * - astray: an unfinished patch that reaches cells of another clue's patch, so it can never grow into the right one.
 * - unsolvable: a legal patch that leaves the rest of the board without a solution.
 */
export type WrongRegionReason = "astray" | "unsolvable";

/** What a hint does, as data. ../text.ts turns it into the sentence the player reads. */
export type Hint =
  | {
      kind: "wrong-region";
      regionId: string;
      clueId: string;
      cells: CellCoordinate[];
      reason: WrongRegionReason;
    }
  | {
      kind: "place-region";
      clueId: string;
      /** The clue the patch belongs to. The sentence that explains the hint describes it. */
      clue: Clue;
      rect: Rect;
      cells: CellCoordinate[];
      technique: Technique;
      /** For clue-single: lookahead had to rule out the clue's other rectangles before this one was the only one left. */
      neededElimination: boolean;
      /** Cell that only this patch can reach, for the cell-single technique. */
      focusCell?: CellCoordinate;
    }
  | { kind: "complete" };

function toFixed(puzzle: PuzzleShape, regions: readonly Region[]): FixedPlacement[] {
  const indexById = new Map(puzzle.clues.map((clue, index) => [clue.id, index]));
  return regions.map((region) => ({ clueIndex: indexById.get(region.clueId) ?? -1, rect: regionRect(region) }));
}

/**
 * Finds a placed patch that cannot be part of any solution. A patch that is
 * impossible on its own is reported first. Otherwise the board is rebuilt one
 * patch at a time, in the order played, and the first patch that makes the
 * board unsolvable is the culprit.
 */
function findWrongRegion(puzzle: PuzzleShape, regions: readonly Region[], candidates: ReturnType<typeof buildCandidates>): Region | null {
  const fixed = toFixed(puzzle, regions);
  if (fixed.some((entry) => entry.clueIndex < 0)) return regions[fixed.findIndex((entry) => entry.clueIndex < 0)];
  if (solve(puzzle, { candidates, fixed, maxSolutions: 1 }).solutionCount > 0) return null;

  for (let i = 0; i < regions.length; i++) {
    if (solve(puzzle, { candidates, fixed: [fixed[i]], maxSolutions: 1 }).solutionCount === 0) return regions[i];
  }
  for (let count = 1; count <= regions.length; count++) {
    if (solve(puzzle, { candidates, fixed: fixed.slice(0, count), maxSolutions: 1 }).solutionCount === 0) return regions[count - 1];
  }
  return regions[regions.length - 1] ?? null;
}

/**
 * Next step for the player, always backed by the solver. Wrong patches are
 * reported before anything else, because a deduction made on top of a wrong
 * patch would mislead.
 */
export function getHint(puzzle: PuzzleShape, placed: readonly Region[]): Hint {
  const candidates = buildCandidates(puzzle);

  // A pending patch is not a legal rectangle yet, so the solver cannot take it as given. It is on the right track
  // if it lies inside the patch its clue has in the solution, and then it is simply left out of the reasoning: the
  // hint for that clue will grow it into the full patch. Otherwise it is a mistake like any other.
  const unfinished = placed.filter((region) => !findCandidate(candidates, puzzle.clues.findIndex((clue) => clue.id === region.clueId), regionRect(region)));
  const regions = placed.filter((region) => !unfinished.includes(region));
  if (unfinished.length > 0) {
    const solved = solve(puzzle, { candidates, maxSolutions: 1 });
    const astray = unfinished.find((region) => {
      const target = solved.solutions[0]?.[puzzle.clues.findIndex((clue) => clue.id === region.clueId)];
      const rect = regionRect(region);
      return !target || rect.row < target.row || rect.column < target.column || rect.row + rect.height > target.row + target.height || rect.column + rect.width > target.column + target.width;
    });
    if (astray) {
      return {
        kind: "wrong-region",
        regionId: astray.id,
        clueId: astray.clueId,
        cells: astray.cells.map((cell) => ({ ...cell })),
        reason: "astray",
      };
    }
  }

  const wrong = findWrongRegion(puzzle, regions, candidates);
  if (wrong) {
    return {
      kind: "wrong-region",
      regionId: wrong.id,
      clueId: wrong.clueId,
      cells: wrong.cells.map((cell) => ({ ...cell })),
      reason: "unsolvable",
    };
  }

  // Every clue has a patch and the solver accepts them all, so nothing is left to do.
  if (regions.length === puzzle.clues.length) return { kind: "complete" };

  const logic = solveWithLogic(puzzle, { candidates, fixed: toFixed(puzzle, regions), maxSteps: 1 });
  const step = logic.steps[0];
  if (!step) return { kind: "complete" };

  const clue = puzzle.clues[step.clueIndex];
  const rect = candidates.candidates[step.candidateIndex].rect;
  const focusCell =
    step.forcedCell === undefined ? undefined : { row: Math.floor(step.forcedCell / puzzle.width), column: step.forcedCell % puzzle.width };

  return {
    kind: "place-region",
    clueId: clue.id,
    clue: { ...clue },
    rect: { ...rect },
    cells: rectCells(rect),
    technique: step.technique,
    neededElimination: step.neededElimination,
    ...(focusCell ? { focusCell } : {}),
  };
}

export function hintMatchesRect(hint: Hint, rect: Rect): boolean {
  return hint.kind === "place-region" && rectEquals(hint.rect, rect);
}
