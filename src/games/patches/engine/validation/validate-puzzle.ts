import { cellKey, inBounds } from "../board/geometry";
import { solve } from "../solver/search";
import type { Puzzle } from "../types";
import { validateState } from "./validate-state";

export type PuzzleValidation = {
  ok: boolean;
  problems: string[];
  solutionCount: number;
};

/**
 * Independent audit of a finished puzzle. It trusts nothing the generator
 * wrote: the stored solution goes through the player-facing validator, and the
 * solver recounts solutions from the clues alone.
 */
export function validatePuzzle(puzzle: Puzzle): PuzzleValidation {
  const problems: string[] = [];

  if (puzzle.width < 1 || puzzle.height < 1) problems.push("Board has no cells.");
  if (puzzle.clues.length === 0) problems.push("Puzzle has no clues.");

  const seenCells = new Set<string>();
  const seenIds = new Set<string>();
  for (const clue of puzzle.clues) {
    if (!inBounds(puzzle.width, puzzle.height, clue)) problems.push(`Clue ${clue.id} is outside the board.`);
    if (seenCells.has(cellKey(clue))) problems.push(`Two clues share cell ${cellKey(clue)}.`);
    if (seenIds.has(clue.id)) problems.push(`Duplicate clue id ${clue.id}.`);
    if (clue.area !== undefined && (!Number.isInteger(clue.area) || clue.area < 1)) problems.push(`Clue ${clue.id} has an invalid area.`);
    seenCells.add(cellKey(clue));
    seenIds.add(clue.id);
  }

  const state = validateState(puzzle, puzzle.solution);
  if (!state.complete) {
    if (state.uncoveredCells.length > 0) problems.push(`Stored solution leaves ${state.uncoveredCells.length} cells uncovered.`);
    if (state.overlappingCells.length > 0) problems.push(`Stored solution overlaps on ${state.overlappingCells.length} cells.`);
    if (state.unusedClueIds.length > 0) problems.push(`Stored solution skips clues: ${state.unusedClueIds.join(", ")}.`);
    for (const entry of state.regionErrors) {
      problems.push(`Region ${entry.regionId}: ${entry.errors.map((error) => error.code).join(", ")}.`);
    }
    if (problems.length === 0) problems.push("Stored solution is not a complete solution.");
  }

  const solved = solve(puzzle, { maxSolutions: 2 });
  if (solved.solutionCount === 0) problems.push("Solver finds no solution.");
  if (solved.solutionCount > 1) problems.push("Solver finds more than one solution.");
  if (solved.aborted) problems.push("Solver gave up before finishing.");

  if (solved.solutionCount === 1 && state.complete) {
    const stored = new Map(puzzle.solution.map((region) => [region.clueId, region]));
    puzzle.clues.forEach((clue, index) => {
      const rect = solved.solutions[0][index];
      const region = stored.get(clue.id);
      if (!region || region.width !== rect.width || region.height !== rect.height || region.area !== rect.width * rect.height) {
        problems.push(`Stored solution disagrees with the solver on clue ${clue.id}.`);
      }
    });
  }

  return { ok: problems.length === 0, problems, solutionCount: solved.solutionCount };
}
