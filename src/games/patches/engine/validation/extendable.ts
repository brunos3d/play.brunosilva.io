import { rectContains, rectInBounds, rectsOverlap } from "../board/geometry";
import { clueAccepts } from "../clues/clue";
import { regionRect } from "../regions/region";
import type { Clue, PuzzleShape, Rect, Region } from "../types";

/**
 * Can `rect` still grow into a legal patch for `clue`? True when some rectangle
 * that contains it satisfies the clue's number and shape, stays on the board,
 * holds no other clue and touches no other patch.
 *
 * This is what separates an unfinished patch from a wrong one. Four cells of a
 * "5" can become five, so the player may leave them and come back. Six cells of
 * a "5" cannot, and neither can a 3x2 of a "6, tall", and those are refused.
 */
export function canGrowIntoLegal(puzzle: PuzzleShape, others: readonly Region[], clue: Clue, rect: Rect): boolean {
  const blocked = [...others.map(regionRect), ...puzzle.clues.filter((other) => other.id !== clue.id).map((other) => ({ row: other.row, column: other.column, width: 1, height: 1 }))];
  if (clue.area !== undefined && rect.width * rect.height > clue.area) return false;

  for (let top = rect.row; top >= 0; top--) {
    for (let bottom = rect.row + rect.height - 1; bottom < puzzle.height; bottom++) {
      const height = bottom - top + 1;
      for (let left = rect.column; left >= 0; left--) {
        for (let right = rect.column + rect.width - 1; right < puzzle.width; right++) {
          const width = right - left + 1;
          if (clue.area !== undefined && width * height > clue.area) break;
          if (!clueAccepts(clue, width, height)) continue;
          const grown: Rect = { row: top, column: left, width, height };
          if (rectInBounds(puzzle.width, puzzle.height, grown) && !blocked.some((other) => rectsOverlap(other, grown))) return true;
        }
      }
    }
  }
  return false;
}

/** True when the cell belongs to another clue or to another clue's patch, which a drag may not cover. */
export function isTakenByOthers(puzzle: PuzzleShape, others: readonly Region[], clueId: string, rect: Rect): boolean {
  return puzzle.clues.some((clue) => clue.id !== clueId && rectContains(rect, clue)) || others.some((region) => region.clueId !== clueId && rectsOverlap(regionRect(region), rect));
}
