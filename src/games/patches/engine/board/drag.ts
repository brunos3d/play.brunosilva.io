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

/**
 * Grows the extent toward `cell`, but only as far as `isFree` allows. The
 * drag can wander over another clue or another patch, and the rectangle simply
 * stops at their edge instead of swallowing them. It grows one row or column at
 * a time, taking turns between the four sides, so it reaches as far as it can
 * in every direction that is still open.
 */
export function extendExtentWithin(extent: DragExtent, cell: CellCoordinate, isFree: (rect: Rect) => boolean): DragExtent {
  const target = extendExtent(extent, cell);
  if (target === extent) return extent;
  let current = extent;
  for (let progressed = true; progressed; ) {
    progressed = false;
    const steps: DragExtent[] = [];
    if (current.top > target.top) steps.push({ ...current, top: current.top - 1 });
    if (current.bottom < target.bottom) steps.push({ ...current, bottom: current.bottom + 1 });
    if (current.left > target.left) steps.push({ ...current, left: current.left - 1 });
    if (current.right < target.right) steps.push({ ...current, right: current.right + 1 });
    for (const step of steps) {
      // Re-check against the latest extent: an earlier step of this round may have changed the other axis.
      const next: DragExtent = { anchor: current.anchor, top: Math.min(current.top, step.top), bottom: Math.max(current.bottom, step.bottom), left: Math.min(current.left, step.left), right: Math.max(current.right, step.right) };
      if (isFree(extentRect(next))) {
        current = next;
        progressed = true;
      }
    }
  }
  return current;
}

export function extentRect(extent: DragExtent): Rect {
  return { row: extent.top, column: extent.left, width: extent.right - extent.left + 1, height: extent.bottom - extent.top + 1 };
}

export function extentIsSingleCell(extent: DragExtent): boolean {
  return extent.top === extent.bottom && extent.left === extent.right;
}
