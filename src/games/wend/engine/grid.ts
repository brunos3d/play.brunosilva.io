const cache = new Map<number, readonly (readonly number[])[]>();

/** Orthogonal neighbours of every cell of a square board. Words never move diagonally. */
export function neighboursOf(size: number): readonly (readonly number[])[] {
  let table = cache.get(size);
  if (!table) {
    table = Array.from({ length: size * size }, (_, cell) => {
      const [row, column] = [Math.floor(cell / size), cell % size];
      const around: number[] = [];
      if (row > 0) around.push(cell - size);
      if (column > 0) around.push(cell - 1);
      if (column < size - 1) around.push(cell + 1);
      if (row < size - 1) around.push(cell + size);
      return around;
    });
    cache.set(size, table);
  }
  return table;
}

export const areNeighbours = (size: number, a: number, b: number): boolean => neighboursOf(size)[a]?.includes(b) ?? false;

/** True when the cells form one orthogonal path with no cell used twice. */
export function isPath(size: number, cells: readonly number[]): boolean {
  if (new Set(cells).size !== cells.length) return false;
  for (let i = 1; i < cells.length; i++) if (!areNeighbours(size, cells[i - 1], cells[i])) return false;
  return cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < size * size);
}

/** Order-free identity of a set of cells. Two paths over the same cells get the same key. */
export const cellSetKey = (cells: readonly number[]): string => [...cells].sort((a, b) => a - b).join(",");

/** Number of corners along a path. */
export function countBends(cells: readonly number[]): number {
  let bends = 0;
  for (let i = 2; i < cells.length; i++) if (cells[i] - cells[i - 1] !== cells[i - 1] - cells[i - 2]) bends++;
  return bends;
}
