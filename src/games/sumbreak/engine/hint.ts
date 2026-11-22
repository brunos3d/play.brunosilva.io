import type { SumbreakState } from "./game/state";
import { type DeadReason, SumbreakSolver } from "./solver";
import type { Merge, SumbreakShape } from "./types";

export type SumbreakHint =
  | { kind: "complete" }
  /** The board cannot be finished any more. `keep` is how many merges to keep: the position right before the one that broke it. */
  | { kind: "dead-end"; keep: number; reason: DeadReason; message: string }
  /** The next merge of a solution, with why it is safe. */
  | { kind: "merge"; merge: Merge; message: string };

const place = (size: number, cell: number): string => `row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;

function direction(size: number, merge: Merge): string {
  const step = merge.to - merge.from;
  return step === 1 ? "to its right" : step === -1 ? "to its left" : step === size ? "below it" : "above it";
}

const BACK = "The board goes back to the last position that can still be finished.";

function deadEndMessage(reason: DeadReason, cells: readonly number[]): string {
  const smallest = Math.min(...cells.filter((value) => value !== 0));
  const count = cells.filter((value) => value === smallest).length;
  if (reason === "odd-count") return `There ${count === 1 ? "is one" : `are ${count}`} ${smallest}${count === 1 ? "" : "s"} left, and the smallest number can only pair up with itself. ${BACK}`;
  if (reason === "split") return `The tiles are split into groups that no longer touch, and tiles never move. ${BACK}`;
  if (reason === "lonely") return `A ${smallest} has no equal neighbour left, and nothing can bring one to it. ${BACK}`;
  return `From here every order of merges gets stuck. ${BACK}`;
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
    return { kind: "dead-end", keep: state.brokenAt, reason, message: deadEndMessage(reason, state.cells) };
  }
  const solution = solver.solve(state.cells);
  if (!solution || solution.length === 0) return { kind: "complete" };
  const merge = solution[0];
  const value = state.cells[merge.from];
  const { total, alive } = solver.options(state.cells);
  const lead = `The smallest number goes first. Drop the ${value} in ${place(shape.size, merge.from)} onto the ${value} ${direction(shape.size, merge)}`;
  const why = total === 1 ? "it is the only pair of them." : alive === 1 ? `of the ${total} ways to merge the ${value}s, it is the only one that leaves a board that can be finished.` : `${alive} of the ${total} ways to merge the ${value}s leave a board that can be finished, and this is one.`;
  return { kind: "merge", merge, message: `${lead}: ${why}` };
}
