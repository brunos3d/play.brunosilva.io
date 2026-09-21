import { boundingRect, rectCells, uniqueCellCount } from "../board/geometry";
import type { CellCoordinate, Rect, Region, RegionShape } from "../types";

/** True when the cells are exactly the filled bounding rectangle, with no duplicates. */
export function isFilledRectangle(cells: readonly CellCoordinate[]): boolean {
  if (cells.length === 0) return false;
  const bounds = boundingRect(cells);
  return uniqueCellCount(cells) === cells.length && cells.length === bounds.width * bounds.height;
}

export function classifyShape(cells: readonly CellCoordinate[]): RegionShape {
  if (!isFilledRectangle(cells)) return "irregular";
  const { width, height } = boundingRect(cells);
  if (width === height) return "square";
  return height > width ? "tall" : "wide";
}

/**
 * Builds a region from its cells. Area, size and shape are always computed
 * here, so callers cannot smuggle in stale or wrong cached values.
 */
export function buildRegion(id: string, clueId: string, cells: readonly CellCoordinate[]): Region {
  const bounds = boundingRect(cells);
  return {
    id,
    clueId,
    cells: cells.map((cell) => ({ row: cell.row, column: cell.column })),
    area: uniqueCellCount(cells),
    width: bounds.width,
    height: bounds.height,
    shape: classifyShape(cells),
  };
}

export function regionFromRect(id: string, clueId: string, rect: Rect): Region {
  return buildRegion(id, clueId, rectCells(rect));
}

export function regionRect(region: Pick<Region, "cells">): Rect {
  return boundingRect(region.cells);
}

export function regionIdForClue(clueId: string): string {
  return `region-${clueId}`;
}
