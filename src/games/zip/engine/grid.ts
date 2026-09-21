import type { CellCoordinate, Wall, ZipShape } from "./types";

export const cellIndex = (width: number, row: number, column: number): number => row * width + column;

export const cellAt = (width: number, index: number): CellCoordinate => ({ row: Math.floor(index / width), column: index % width });

export const wallKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

export const makeWall = (a: number, b: number): Wall => (a < b ? { a, b } : { a: b, b: a });

/** Orthogonal neighbours on an open grid, ignoring walls. */
export function gridNeighbors(width: number, height: number, index: number): number[] {
  const row = Math.floor(index / width);
  const column = index % width;
  const result: number[] = [];
  if (row > 0) result.push(index - width);
  if (column < width - 1) result.push(index + 1);
  if (row < height - 1) result.push(index + width);
  if (column > 0) result.push(index - 1);
  return result;
}

/**
 * Everything the rules ask about a board, computed once: which cells connect
 * (walls already removed), which number sits where, and where the path must
 * start and end.
 */
export type Topology = {
  width: number;
  height: number;
  cellCount: number;
  /** Cells the path has to cover: every cell that is not blocked. */
  playableCount: number;
  /** 1 for a blocked cell. The path cannot enter it and does not have to cover it. */
  blockedAt: Uint8Array;
  /** Passable neighbours per cell. A blocked cell has none, and is nobody's neighbour. */
  neighbors: number[][];
  /** Checkpoint number per cell, 0 for a plain cell. */
  numberAt: Int16Array;
  /** 1 for a numbered cell that shows "?" to the player. */
  hiddenAt: Uint8Array;
  lastNumber: number;
  /** Cell of number 1. -1 when the board has none. */
  start: number;
  /** Cell of the highest number. The path must end there. */
  end: number;
  walls: Set<string>;
};

export function buildTopology(shape: ZipShape): Topology {
  const { width, height } = shape;
  const cellCount = width * height;
  const walls = new Set(shape.walls.map((wall) => wallKey(wall.a, wall.b)));
  const blockedAt = new Uint8Array(cellCount);
  for (const cell of shape.blocked ?? []) blockedAt[cell] = 1;
  const playableCount = cellCount - blockedAt.reduce((sum, flag) => sum + flag, 0);
  const neighbors = Array.from({ length: cellCount }, (_, index) =>
    blockedAt[index] ? [] : gridNeighbors(width, height, index).filter((other) => !blockedAt[other] && !walls.has(wallKey(index, other))),
  );

  const numberAt = new Int16Array(cellCount);
  const hiddenAt = new Uint8Array(cellCount);
  let lastNumber = 0;
  let start = -1;
  let end = -1;
  for (const checkpoint of shape.checkpoints) {
    const index = cellIndex(width, checkpoint.row, checkpoint.column);
    numberAt[index] = checkpoint.number;
    if (checkpoint.hidden) hiddenAt[index] = 1;
    if (checkpoint.number === 1) start = index;
    if (checkpoint.number > lastNumber) {
      lastNumber = checkpoint.number;
      end = index;
    }
  }
  return { width, height, cellCount, playableCount, blockedAt, neighbors, numberAt, hiddenAt, lastNumber, start, end, walls };
}

export function areAdjacent(width: number, a: number, b: number): boolean {
  const rowGap = Math.abs(Math.floor(a / width) - Math.floor(b / width));
  const columnGap = Math.abs((a % width) - (b % width));
  return rowGap + columnGap === 1;
}
