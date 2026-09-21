import { cellIndex } from "../board/geometry";
import type { CellCoordinate, PuzzleShape, Region } from "../types";
import { type RegionError, validateRegion } from "./validate-region";

export type StateValidation = {
  /** True only when the board is a correct, complete solution. */
  complete: boolean;
  /** True when every placed region is legal and nothing overlaps. Gaps are allowed. */
  consistent: boolean;
  uncoveredCells: CellCoordinate[];
  overlappingCells: CellCoordinate[];
  /** Clue ids that are not inside any region. */
  unusedClueIds: string[];
  /** Clue ids claimed by more than one region. */
  duplicatedClueIds: string[];
  regionErrors: { regionId: string; errors: RegionError[] }[];
};

/**
 * Full rule check of a board. Completion is decided here and nowhere else:
 * every cell covered once, every region legal, every clue used exactly once.
 */
export function validateState(puzzle: PuzzleShape, regions: readonly Region[]): StateValidation {
  const coverage = new Uint16Array(puzzle.width * puzzle.height);
  for (const region of regions) {
    for (const cell of region.cells) {
      if (cell.row >= 0 && cell.row < puzzle.height && cell.column >= 0 && cell.column < puzzle.width) {
        coverage[cellIndex(puzzle.width, cell.row, cell.column)]++;
      }
    }
  }

  const uncoveredCells: CellCoordinate[] = [];
  const overlappingCells: CellCoordinate[] = [];
  for (let row = 0; row < puzzle.height; row++) {
    for (let column = 0; column < puzzle.width; column++) {
      const count = coverage[cellIndex(puzzle.width, row, column)];
      if (count === 0) uncoveredCells.push({ row, column });
      else if (count > 1) overlappingCells.push({ row, column });
    }
  }

  const regionErrors: StateValidation["regionErrors"] = [];
  const clueUse = new Map<string, number>();
  for (const region of regions) {
    const result = validateRegion(puzzle, regions, region);
    if (!result.ok) regionErrors.push({ regionId: region.id, errors: result.errors });
    if (result.clue) clueUse.set(result.clue.id, (clueUse.get(result.clue.id) ?? 0) + 1);
  }

  const unusedClueIds = puzzle.clues.filter((clue) => !clueUse.has(clue.id)).map((clue) => clue.id);
  const duplicatedClueIds = [...clueUse].filter(([, uses]) => uses > 1).map(([id]) => id);
  const consistent =
    regionErrors.length === 0 && overlappingCells.length === 0 && duplicatedClueIds.length === 0;

  return {
    complete:
      consistent &&
      uncoveredCells.length === 0 &&
      unusedClueIds.length === 0 &&
      regions.length === puzzle.clues.length,
    consistent,
    uncoveredCells,
    overlappingCells,
    unusedClueIds,
    duplicatedClueIds,
    regionErrors,
  };
}
