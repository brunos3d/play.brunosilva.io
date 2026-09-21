import type { CellCoordinate, Rect } from "../types";

/**
 * A drag that starts on a clue cell and "paints" its patch.
 *
 * The patch is the bounding rectangle of every cell the pointer has visited,
 * so it only grows while the drag lasts. A clue in the middle of its patch can
 * then be drawn in one gesture: drag up, then down, and the rows above stay.
 * With a plain anchor-to-cursor rectangle the clue could only ever sit in a
 * corner. To get a smaller patch the player cancels or redraws.
 */
export type DragExtent = {
  anchor: CellCoordinate;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function startExtent(anchor: CellCoordinate): DragExtent {
  return { anchor, top: anchor.row, bottom: anchor.row, left: anchor.column, right: anchor.column };
}

/** Returns the same object when the cell is already inside, so callers can skip a render. */
export function extendExtent(extent: DragExtent, cell: CellCoordinate): DragExtent {
  const top = Math.min(extent.top, cell.row);
  const bottom = Math.max(extent.bottom, cell.row);
  const left = Math.min(extent.left, cell.column);
  const right = Math.max(extent.right, cell.column);
  if (top === extent.top && bottom === extent.bottom && left === extent.left && right === extent.right) return extent;
  return { anchor: extent.anchor, top, bottom, left, right };
}

export function extentRect(extent: DragExtent): Rect {
  return { row: extent.top, column: extent.left, width: extent.right - extent.left + 1, height: extent.bottom - extent.top + 1 };
}

export function extentIsSingleCell(extent: DragExtent): boolean {
  return extent.top === extent.bottom && extent.left === extent.right;
}
