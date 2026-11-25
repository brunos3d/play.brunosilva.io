import type { Merge } from "./types";

/**
 * The rules of Sumbreak, all of them:
 *
 * 1. A tile merges with a tile that holds the same number.
 * 2. The two tiles must be side neighbours. Diagonals do not count.
 * 3. The tile that was dropped on keeps its place and holds the sum. The other
 *    cell is left empty.
 * 4. Nothing slides, so a tile never moves into an empty cell and never reaches
 *    across one.
 * 5. The puzzle is solved when one tile is left.
 */
export type MergeErrorCode = "empty-source" | "empty-target" | "not-adjacent" | "different";

/**
 * Why a merge is refused, as data: the rule that stops it and the numbers its
 * sentence needs. For "different", `values` holds the two numbers, `from` and
 * `to`. The sentence itself is built in ./text.ts, in the player's language.
 */
export type MergeError = { code: MergeErrorCode; values?: Record<string, number> };

const neighbourCache = new Map<number, number[][]>();

/** Side neighbours of every cell of a size-by-size board. */
export function neighboursOf(size: number): number[][] {
  let table = neighbourCache.get(size);
  if (!table) {
    table = Array.from({ length: size * size }, (_, cell) => {
      const row = Math.floor(cell / size);
      const column = cell % size;
      const list: number[] = [];
      if (row > 0) list.push(cell - size);
      if (column > 0) list.push(cell - 1);
      if (column < size - 1) list.push(cell + 1);
      if (row < size - 1) list.push(cell + size);
      return list;
    });
    neighbourCache.set(size, table);
  }
  return table;
}

/** Null when the merge is legal, or the rule that refuses it. */
export function checkMerge(size: number, cells: readonly number[], merge: Merge): MergeError | null {
  const { from, to } = merge;
  const inside = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < size * size;
  if (!inside(from) || !inside(to) || cells[from] === 0) return { code: "empty-source" };
  if (from === to || !neighboursOf(size)[from].includes(to)) return { code: "not-adjacent" };
  if (cells[to] === 0) return { code: "empty-target" };
  if (cells[from] !== cells[to]) return { code: "different", values: { from: cells[from], to: cells[to] } };
  return null;
}

/** The board after a legal merge. */
export function applyMerge(cells: readonly number[], merge: Merge): number[] {
  const next = [...cells];
  next[merge.to] = cells[merge.to] + cells[merge.from];
  next[merge.from] = 0;
  return next;
}

/** Every legal merge, both directions of each pair. */
export function legalMerges(size: number, cells: readonly number[]): Merge[] {
  const neighbours = neighboursOf(size);
  const merges: Merge[] = [];
  for (let from = 0; from < cells.length; from++) {
    if (cells[from] === 0) continue;
    for (const to of neighbours[from]) if (cells[to] === cells[from]) merges.push({ from, to });
  }
  return merges;
}

export function countTiles(cells: readonly number[]): number {
  let count = 0;
  for (const value of cells) if (value !== 0) count++;
  return count;
}

export const isSolved = (cells: readonly number[]): boolean => countTiles(cells) === 1;

/** More than one tile and no merge left. */
export const isStuck = (size: number, cells: readonly number[]): boolean => countTiles(cells) > 1 && legalMerges(size, cells).length === 0;

/** Plays a list of merges from a board through the rules. Returns null at the first illegal one. */
export function replayMerges(size: number, cells: readonly number[], merges: readonly Merge[]): number[] | null {
  let board = [...cells];
  for (const merge of merges) {
    if (checkMerge(size, board, merge)) return null;
    board = applyMerge(board, merge);
  }
  return board;
}
