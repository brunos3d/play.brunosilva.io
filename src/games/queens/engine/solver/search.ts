import { type Topology, buildTopology } from "../grid";
import type { QueensShape } from "../types";

export type SearchOptions = {
  /** Stop after this many solutions. 2 is enough to tell "unique" from "not unique". */
  maxSolutions?: number;
  /** Node budget. The search is cut by work done, never by a clock, so every machine gets the same answer. */
  maxNodes?: number;
};

export type SearchResult = {
  solutionCount: number;
  /** Each solution lists the queen's cell per row, top row first. */
  solutions: number[][];
  nodes: number;
  /** False when the node budget ran out before the search finished. */
  exhausted: boolean;
};

const DEFAULT_MAX_NODES = 2_000_000;

/**
 * Backtracking search, one row at a time. A queen needs a free column, a free
 * region and a column at least two away from the queen in the row above, which
 * is all "no touching" means between neighbouring rows. Columns are tried left
 * to right, so the order of the solutions is fixed.
 */
export function solveQueens(shape: QueensShape, options: SearchOptions = {}, topology: Topology = buildTopology(shape)): SearchResult {
  const { size, regionOf } = topology;
  const maxSolutions = options.maxSolutions ?? 2;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const solutions: number[][] = [];
  const columns = new Int32Array(size);
  let nodes = 0;
  let exhausted = true;

  const place = (row: number, usedColumns: number, usedRegions: number): boolean => {
    if (row === size) {
      solutions.push(Array.from(columns, (column, index) => index * size + column));
      return solutions.length >= maxSolutions;
    }
    const previous = row > 0 ? columns[row - 1] : -9;
    for (let column = 0; column < size; column++) {
      if (usedColumns & (1 << column)) continue;
      if (column - previous <= 1 && previous - column <= 1) continue;
      const region = regionOf[row * size + column];
      if (usedRegions & (1 << region)) continue;
      if (++nodes > maxNodes) {
        exhausted = false;
        return true;
      }
      columns[row] = column;
      if (place(row + 1, usedColumns | (1 << column), usedRegions | (1 << region))) return true;
    }
    return false;
  };

  // A board with the wrong number of regions has no solution by definition.
  if (topology.regionCount === size) place(0, 0, 0);
  return { solutionCount: solutions.length, solutions, nodes, exhausted };
}
