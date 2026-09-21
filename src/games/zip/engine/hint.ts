import type { Topology } from "./grid";

export type ZipHint =
  /** The path left the solution. `keep` cells are right, the rest has to go. */
  | { kind: "wrong-turn"; keep: number; wrongCells: number[]; message: string }
  /** The next stretch of the solution, up to and including the next number. */
  | { kind: "extend"; cells: number[]; message: string }
  | { kind: "complete"; message: string };

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
    const lastGood = keep > 0 ? topology.numberAt[solution[keep - 1]] : 0;
    return {
      kind: "wrong-turn",
      keep,
      wrongCells: path.slice(keep),
      message:
        keep === 0
          ? "The path has to start on 1."
          : `The path goes wrong ${lastGood ? `right after ${lastGood}` : `after ${keep} cells`}. From here it can no longer cover every cell, so that part comes off.`,
    };
  }
  if (path.length === solution.length) return { kind: "complete", message: "The board is complete." };

  const cells: number[] = [];
  for (let index = path.length; index < solution.length; index++) {
    cells.push(solution[index]);
    // Stop on the next number, but never hand out just the starting cell.
    if (topology.numberAt[solution[index]] !== 0 && index > 0) break;
  }
  const target = topology.numberAt[cells[cells.length - 1]];
  return { kind: "extend", cells, message: `This is the only way to ${target} that still leaves every other cell reachable.` };
}
