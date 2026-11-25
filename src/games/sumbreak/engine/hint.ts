import type { SumbreakState } from "./game/state";
import { type DeadReason, SumbreakSolver } from "./solver";
import type { Merge, SumbreakShape } from "./types";

/** Where the tile a merge lands on sits, seen from the tile that moves. */
export type MergeDirection = "right" | "left" | "below" | "above";

/** What a hint does, as data. ./text.ts turns it into the sentence the player reads. */
export type SumbreakHint =
  | { kind: "complete" }
  /**
   * The board cannot be finished any more. `keep` is how many merges to keep:
   * the position right before the one that broke it. `smallest` is the smallest
   * number on the board and `count` how many tiles hold it, which is what the
   * reasons "odd-count" and "lonely" talk about.
   */
  | { kind: "dead-end"; keep: number; reason: DeadReason; smallest: number; count: number }
  /**
   * The next merge of a solution, with what makes it safe. The tile that moves
   * holds `value` and sits on `row` and `column`, both 1-based. Of the `total`
   * ways to merge the smallest number, `alive` leave a board that can be finished.
   */
  | { kind: "merge"; merge: Merge; value: number; row: number; column: number; direction: MergeDirection; total: number; alive: number };

function directionOf(size: number, merge: Merge): MergeDirection {
  const step = merge.to - merge.from;
  return step === 1 ? "right" : step === -1 ? "left" : step === size ? "below" : "above";
}

/**
 * A hint acts. If the board can no longer be finished, it names what went wrong
 * and points at the position to go back to. Otherwise it gives the next merge
 * of a solution: always a merge of the smallest number, which has to pair up
 * before anything else can.
 */
export function getSumbreakHint(shape: SumbreakShape, state: SumbreakState): SumbreakHint {
  if (state.status === "solved") return { kind: "complete" };
  const solver = new SumbreakSolver(shape.size);
  if (state.brokenAt !== null) {
    const reason = solver.quickDeadReason(state.cells) ?? "search";
    const smallest = Math.min(...state.cells.filter((value) => value !== 0));
    return { kind: "dead-end", keep: state.brokenAt, reason, smallest, count: state.cells.filter((value) => value === smallest).length };
  }
  const solution = solver.solve(state.cells);
  if (!solution || solution.length === 0) return { kind: "complete" };
  const merge = solution[0];
  const { total, alive } = solver.options(state.cells);
  return {
    kind: "merge",
    merge,
    value: state.cells[merge.from],
    row: Math.floor(merge.from / shape.size) + 1,
    column: (merge.from % shape.size) + 1,
    direction: directionOf(shape.size, merge),
    total,
    alive,
  };
}
