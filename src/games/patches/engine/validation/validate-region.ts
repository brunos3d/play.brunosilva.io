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

export type RegionError = { code: RegionErrorCode; message: string };

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
  const add = (code: RegionErrorCode, message: string) => errors.push({ code, message });

  if (region.cells.length === 0) {
    add("empty", "The patch has no cells.");
    return { ok: false, errors, clue: null };
  }
  if (region.cells.some((cell) => !inBounds(puzzle.width, puzzle.height, cell))) {
    add("out-of-bounds", "The patch leaves the board.");
    return { ok: false, errors, clue: null };
  }
  if (!isFilledRectangle(region.cells)) {
    add("not-rectangle", "A patch must be a filled rectangle.");
  }

  const derived = buildRegion(region.id, region.clueId, region.cells);
  const inside = cluesInside(puzzle, region.cells);
  let clue: Clue | null = null;

  if (inside.length === 0) {
    add("no-clue", "A patch must contain a clue.");
  } else if (inside.length > 1) {
    add("multiple-clues", `A patch can hold only one clue. This one holds ${inside.length}.`);
  } else {
    clue = inside[0];
    if (region.clueId !== clue.id) {
      add("clue-mismatch", "The patch is linked to a clue it does not contain.");
    }
    if (clue.area !== undefined && clue.area !== derived.area) {
      add("wrong-area", `This clue needs ${clue.area} cells. The patch has ${derived.area}.`);
    }
    if (derived.shape !== "irregular" && !shapeAccepts(clue.shape, derived.width, derived.height)) {
      add("wrong-shape", `This clue needs ${shapeWord(clue)}. The patch is ${derived.width} by ${derived.height}.`);
    }
  }

  const own = new Set(region.cells.map(cellKey));
  const collides = placed.some(
    (other) => other.id !== region.id && other.cells.some((cell) => own.has(cellKey(cell))),
  );
  if (collides) add("overlap", "The patch overlaps another patch.");

  return { ok: errors.length === 0, errors, clue };
}

function shapeWord(clue: Clue): string {
  if (clue.shape === "square") return "a square";
  if (clue.shape === "tall") return "a tall rectangle";
  if (clue.shape === "wide") return "a wide rectangle";
  return "a rectangle";
}
