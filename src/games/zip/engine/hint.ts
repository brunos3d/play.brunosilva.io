import type { Topology } from "./grid";

/** What a hint does, as data. ./text.ts turns it into the sentence the player reads. */
export type ZipHint =
  /** The path left the solution. `keep` cells are right, the rest has to go. `lastGood` is the last number the right part reached, or 0. */
  | { kind: "wrong-turn"; keep: number; wrongCells: number[]; lastGood: number }
  /** The next stretch of the solution, up to and including the next number, `target`. */
  | { kind: "extend"; cells: number[]; target: number }
  | { kind: "complete" };

/**
 * Next step for the player. Generated puzzles have exactly one solution, proven
 * by the solver, so comparing the path with it is a solver-backed answer and
 * never a guess. A wrong turn is reported before anything else, because more
 * path on top of a wrong turn would only lead further astray.
 */
export function getZipHint(topology: Topology, solution: readonly number[], path: readonly number[]): ZipHint {
  let keep = 0;
  while (keep < path.length && path[keep] === solution[keep]) keep++;

  if (keep < path.length) {
    return { kind: "wrong-turn", keep, wrongCells: path.slice(keep), lastGood: keep > 0 ? topology.numberAt[solution[keep - 1]] : 0 };
  }
  if (path.length === solution.length) return { kind: "complete" };

  const cells: number[] = [];
  for (let index = path.length; index < solution.length; index++) {
    cells.push(solution[index]);
    // Stop on the next number, but never hand out just the starting cell.
    if (topology.numberAt[solution[index]] !== 0 && index > 0) break;
  }
  return { kind: "extend", cells, target: topology.numberAt[cells[cells.length - 1]] };
}
