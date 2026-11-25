import { cellKey, inBounds } from "../board/geometry";
import { shapeAccepts } from "../clues/clue";
import { buildRegion, isFilledRectangle } from "../regions/region";
import type { CellCoordinate, Clue, PuzzleShape, Region } from "../types";

export type RegionErrorCode =
  | "empty"
  | "out-of-bounds"
  | "not-rectangle"
  | "no-clue"
  | "multiple-clues"
  | "clue-mismatch"
  | "wrong-area"
  | "wrong-shape"
  | "overlap";

/** Why a region breaks the rules, as data: a code and the values its sentence needs. ../text.ts turns it into the sentence the player reads. */
export type RegionError = { code: RegionErrorCode; values?: Record<string, string | number> };

export type RegionValidation = {
  ok: boolean;
  errors: RegionError[];
  /** The single clue inside the region, when there is exactly one. */
  clue: Clue | null;
};

export function cluesInside(puzzle: PuzzleShape, cells: readonly CellCoordinate[]): Clue[] {
  const keys = new Set(cells.map(cellKey));
  return puzzle.clues.filter((clue) => keys.has(cellKey(clue)));
}

/**
 * Checks one region against the rules and against the regions already on the
 * board. Area, size and shape are recomputed from `region.cells`, so the cached
 * fields on the region are never trusted. A region with the same id in `placed`
 * is ignored, which lets callers re-validate a region that is already placed.
 */
export function validateRegion(
  puzzle: PuzzleShape,
  placed: readonly Region[],
  region: Pick<Region, "id" | "clueId" | "cells">,
): RegionValidation {
  const errors: RegionError[] = [];
  const add = (code: RegionErrorCode, values?: RegionError["values"]) => errors.push(values ? { code, values } : { code });

  if (region.cells.length === 0) {
    add("empty");
    return { ok: false, errors, clue: null };
  }
  if (region.cells.some((cell) => !inBounds(puzzle.width, puzzle.height, cell))) {
    add("out-of-bounds");
    return { ok: false, errors, clue: null };
  }
  if (!isFilledRectangle(region.cells)) {
    add("not-rectangle");
  }

  const derived = buildRegion(region.id, region.clueId, region.cells);
  const inside = cluesInside(puzzle, region.cells);
  let clue: Clue | null = null;

  if (inside.length === 0) {
    add("no-clue");
  } else if (inside.length > 1) {
    add("multiple-clues", { count: inside.length });
  } else {
    clue = inside[0];
    if (region.clueId !== clue.id) {
      add("clue-mismatch");
    }
    if (clue.area !== undefined && clue.area !== derived.area) {
      add("wrong-area", { needed: clue.area, area: derived.area });
    }
    if (derived.shape !== "irregular" && !shapeAccepts(clue.shape, derived.width, derived.height)) {
      add("wrong-shape", { shape: clue.shape ?? "unconstrained", width: derived.width, height: derived.height });
    }
  }

  const own = new Set(region.cells.map(cellKey));
  const collides = placed.some(
    (other) => other.id !== region.id && other.cells.some((cell) => own.has(cellKey(cell))),
  );
  if (collides) add("overlap");

  return { ok: errors.length === 0, errors, clue };
}
