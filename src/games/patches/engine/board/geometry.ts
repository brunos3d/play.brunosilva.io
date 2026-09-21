import type { CellCoordinate, Rect } from "../types";

export function cellIndex(width: number, row: number, column: number): number {
  return row * width + column;
}

export function cellKey(cell: CellCoordinate): string {
  return `${cell.row},${cell.column}`;
}

export function inBounds(width: number, height: number, cell: CellCoordinate): boolean {
  return cell.row >= 0 && cell.row < height && cell.column >= 0 && cell.column < width;
}

/** Rectangle spanned by two cells, in any order. This is what a drag produces. */
export function rectFromCorners(a: CellCoordinate, b: CellCoordinate): Rect {
  const row = Math.min(a.row, b.row);
  const column = Math.min(a.column, b.column);
  return {
    row,
    column,
    width: Math.abs(a.column - b.column) + 1,
    height: Math.abs(a.row - b.row) + 1,
  };
}

export function rectCells(rect: Rect): CellCoordinate[] {
  const cells: CellCoordinate[] = [];
  for (let row = rect.row; row < rect.row + rect.height; row++) {
    for (let column = rect.column; column < rect.column + rect.width; column++) {
      cells.push({ row, column });
    }
  }
  return cells;
}

export function rectContains(rect: Rect, cell: CellCoordinate): boolean {
  return (
    cell.row >= rect.row &&
    cell.row < rect.row + rect.height &&
    cell.column >= rect.column &&
    cell.column < rect.column + rect.width
  );
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.column < b.column + b.width &&
    b.column < a.column + a.width &&
    a.row < b.row + b.height &&
    b.row < a.row + a.height
  );
}

export function rectInBounds(width: number, height: number, rect: Rect): boolean {
  return (
    rect.width >= 1 &&
    rect.height >= 1 &&
    rect.row >= 0 &&
    rect.column >= 0 &&
    rect.row + rect.height <= height &&
    rect.column + rect.width <= width
  );
}

export function rectEquals(a: Rect, b: Rect): boolean {
  return a.row === b.row && a.column === b.column && a.width === b.width && a.height === b.height;
}

/** Smallest rectangle around a non-empty cell list. */
export function boundingRect(cells: readonly CellCoordinate[]): Rect {
  if (cells.length === 0) throw new RangeError("boundingRect() needs at least one cell");
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  for (const cell of cells) {
    top = Math.min(top, cell.row);
    left = Math.min(left, cell.column);
    bottom = Math.max(bottom, cell.row);
    right = Math.max(right, cell.column);
  }
  return { row: top, column: left, width: right - left + 1, height: bottom - top + 1 };
}

export function uniqueCellCount(cells: readonly CellCoordinate[]): number {
  return new Set(cells.map(cellKey)).size;
}
