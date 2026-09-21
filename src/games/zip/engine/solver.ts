import { type Topology, buildTopology } from "./grid";
import type { ZipShape } from "./types";

export type SolveOptions = {
  /** Stop after this many solutions. 2 is enough to decide uniqueness. */
  maxSolutions?: number;
  /**
   * Search budget in visited nodes. It replaces the old time limit on purpose:
   * a time limit expires sooner on a slow phone, so the same seed could grow
   * different walls there. A node count is the same everywhere.
   */
  maxNodes?: number;
  /** Cells the path must start with, for example the player's path. */
  prefix?: readonly number[];
};

export type SolveResult = {
  solutions: number[][];
  solutionCount: number;
  /** Exactly one solution, and the search ran to the end. */
  unique: boolean;
  nodes: number;
  /** False when the node budget stopped the search early. */
  exhausted: boolean;
};

const DEFAULT_MAX_NODES = 400_000;

/**
 * Backtracking search for Hamiltonian paths that take the numbers in order and
 * end on the last one. Three prunings keep it small:
 * - every unvisited cell must still be reachable from the head,
 * - every unvisited cell needs a way in and a way out (the end cell only a way in),
 * - the last number may only be entered as the final step.
 * Neighbours are tried fewest-exits-first (Warnsdorff).
 */
export function solveZip(shape: ZipShape, options: SolveOptions = {}, prebuilt?: Topology): SolveResult {
  const topology = prebuilt ?? buildTopology(shape);
  const { cellCount, neighbors, numberAt, hiddenAt, lastNumber, start, end } = topology;
  const maxSolutions = options.maxSolutions ?? 2;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const result: SolveResult = { solutions: [], solutionCount: 0, unique: false, nodes: 0, exhausted: true };
  if (start < 0 || end < 0) return result;

  const visited = new Uint8Array(cellCount);
  const path = new Int32Array(cellCount);
  const stamp = new Int32Array(cellCount);
  const queue = new Int32Array(cellCount);
  let stampId = 0;
  let length = 0;
  let expected = 1;

  // `expected` is the position the next numbered cell will have on the path. A visible number must match it.
  // A hidden one fits any position, exactly as in rules.ts.
  const fits = (cell: number): boolean => numberAt[cell] === 0 || hiddenAt[cell] === 1 || numberAt[cell] === expected;
  const enter = (cell: number): void => {
    visited[cell] = 1;
    path[length++] = cell;
    if (numberAt[cell] !== 0) expected++;
  };

  const prefix = options.prefix && options.prefix.length > 0 ? options.prefix : [start];
  for (let i = 0; i < prefix.length; i++) {
    const cell = prefix[i];
    const legalFirst = i === 0 && cell === start;
    const legalNext = i > 0 && !visited[cell] && neighbors[prefix[i - 1]].includes(cell) && fits(cell);
    if (!legalFirst && !legalNext) return result;
    enter(cell);
  }

  const freeExits = (cell: number, head: number): number => {
    let count = 0;
    for (const other of neighbors[cell]) if (!visited[other] || other === head) count++;
    return count;
  };

  /** Flood fill from the head: are all unvisited cells reachable, and does each have enough exits? */
  const stillSolvable = (head: number): boolean => {
    const remaining = cellCount - length;
    if (remaining === 0) return true;
    stampId++;
    let reached = 0;
    let tail = 0;
    for (const other of neighbors[head]) {
      if (!visited[other] && stamp[other] !== stampId) {
        stamp[other] = stampId;
        queue[tail++] = other;
      }
    }
    for (let i = 0; i < tail; i++) {
      const cell = queue[i];
      reached++;
      const exits = freeExits(cell, head);
      if (exits < (cell === end ? 1 : 2)) return false;
      for (const other of neighbors[cell]) {
        if (!visited[other] && stamp[other] !== stampId) {
          stamp[other] = stampId;
          queue[tail++] = other;
        }
      }
    }
    return reached === remaining;
  };

  const search = (): void => {
    if (result.solutionCount >= maxSolutions || !result.exhausted) return;
    if (++result.nodes > maxNodes) {
      result.exhausted = false;
      return;
    }
    const head = path[length - 1];
    if (length === cellCount) {
      if (head === end) {
        result.solutionCount++;
        result.solutions.push(Array.from(path));
      }
      return;
    }
    if (head === end || !stillSolvable(head)) return;

    const options: number[] = [];
    for (const other of neighbors[head]) {
      if (visited[other]) continue;
      if (!fits(other)) continue;
      if (numberAt[other] === lastNumber && length + 1 !== cellCount) continue;
      options.push(other);
    }
    options.sort((a, b) => freeExits(a, -1) - freeExits(b, -1));

    const expectedHere = expected;
    for (const other of options) {
      enter(other);
      search();
      length--;
      visited[other] = 0;
      expected = expectedHere;
      if (result.solutionCount >= maxSolutions || !result.exhausted) return;
    }
  };

  if (expected - 1 <= lastNumber) search();
  result.unique = result.solutionCount === 1 && result.exhausted;
  return result;
}
