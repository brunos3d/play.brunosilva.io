import { rectCells, rectEquals } from "../board/geometry";
import { describeClue } from "../clues/clue";
import { regionRect } from "../regions/region";
import { buildCandidates } from "../solver/candidates";
import { type Technique, solveWithLogic } from "../solver/logic";
import { type FixedPlacement, solve } from "../solver/search";
import type { CellCoordinate, PuzzleShape, Rect, Region } from "../types";

export type Hint =
  | {
      kind: "wrong-region";
      regionId: string;
      clueId: string;
      cells: CellCoordinate[];
      message: string;
    }
  | {
      kind: "place-region";
      clueId: string;
      rect: Rect;
      cells: CellCoordinate[];
      technique: Technique;
      /** Cell that only this patch can reach, for the cell-single technique. */
      focusCell?: CellCoordinate;
      message: string;
    }
  | { kind: "complete"; message: string };

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

function explain(technique: Technique, clueText: string, rect: Rect, neededElimination: boolean, focus?: CellCoordinate): string {
  const size = `${rect.width} by ${rect.height}`;
  if (technique === "clue-single") {
    return neededElimination
      ? `This clue (${clueText}) has one option left. Every other rectangle would leave a cell that no clue can reach. Draw the ${size} patch.`
      : `Only one rectangle fits this clue (${clueText}) in the space that is left. Draw the ${size} patch.`;
  }
  if (technique === "cell-single" && focus) {
    return `The cell in row ${focus.row + 1}, column ${focus.column + 1} can only be reached from this clue (${clueText}), and only by this ${size} patch.`;
  }
  return `No single-step deduction is available, so this one comes from the solver: the clue (${clueText}) takes a ${size} patch here.`;
}

/**
 * Next step for the player, always backed by the solver. Wrong patches are
 * reported before anything else, because a deduction made on top of a wrong
 * patch would mislead.
 */
export function getHint(puzzle: PuzzleShape, regions: readonly Region[]): Hint {
  const candidates = buildCandidates(puzzle);
  const wrong = findWrongRegion(puzzle, regions, candidates);
  if (wrong) {
    return {
      kind: "wrong-region",
      regionId: wrong.id,
      clueId: wrong.clueId,
      cells: wrong.cells.map((cell) => ({ ...cell })),
      message: "This patch follows its clue, but the rest of the board cannot be completed around it. Tap it to remove it.",
    };
  }

  // Every clue has a patch and the solver accepts them all, so nothing is left to do.
  if (regions.length === puzzle.clues.length) return { kind: "complete", message: "The board is complete." };

  const logic = solveWithLogic(puzzle, { candidates, fixed: toFixed(puzzle, regions), maxSteps: 1 });
  const step = logic.steps[0];
  if (!step) return { kind: "complete", message: "The board is complete." };

  const clue = puzzle.clues[step.clueIndex];
  const rect = candidates.candidates[step.candidateIndex].rect;
  const focusCell =
    step.forcedCell === undefined ? undefined : { row: Math.floor(step.forcedCell / puzzle.width), column: step.forcedCell % puzzle.width };

  return {
    kind: "place-region",
    clueId: clue.id,
    rect: { ...rect },
    cells: rectCells(rect),
    technique: step.technique,
    ...(focusCell ? { focusCell } : {}),
    message: explain(step.technique, describeClue(clue), rect, step.neededElimination, focusCell),
  };
}

export function hintMatchesRect(hint: Hint, rect: Rect): boolean {
  return hint.kind === "place-region" && rectEquals(hint.rect, rect);
}
