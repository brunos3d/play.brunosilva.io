import type { Topology } from "../grid";
import { checkStep } from "../rules";
import { solveZip } from "../solver";
import type { ZipShape } from "../types";

export type TrapReport = {
  /** Weighted sum of traps. The generator steers each tier by this number. */
  score: number;
  /** Wrong turns that look fine for a while: more than SHALLOW_NODES of search to refute. */
  deepTraps: number;
  /** Wrong turns that fail after a short look ahead. */
  shallowTraps: number;
  /** Steps of the solution at which at least one wrong turn survives a glance. */
  decisions: number;
};

/** A wrong turn refuted within this many search nodes is dead on arrival: a stranded cell or a cut-off area right away. */
const OBVIOUS_NODES = 3;
const SHALLOW_NODES = 40;
/** A person does not look further ahead than this either, so deeper traps all count the same. */
const REFUTATION_CAP = 300;
const WEIGHT = { shallow: 1, deep: 3, capped: 5 } as const;

/**
 * How hard a board is to solve, measured by its traps. At every step of the
 * solution, each legal wrong turn is handed to the solver, which has to prove
 * that the board can no longer be finished from there. The number of nodes that
 * proof takes says how long the mistake stays hidden. A board where every wrong
 * turn dies at once is a colouring exercise, however few numbers it has. A
 * board with deep traps makes the player think ahead.
 */
export function measureTraps(shape: ZipShape, topology: Topology, solution: readonly number[]): TrapReport {
  const report: TrapReport = { score: 0, deepTraps: 0, shallowTraps: 0, decisions: 0 };
  const prefix: number[] = [solution[0]];

  for (let step = 1; step < solution.length; step++) {
    const head = solution[step - 1];
    let decision = false;
    for (const turn of topology.neighbors[head]) {
      if (turn === solution[step] || checkStep(topology, prefix, turn) !== null) continue;
      // Entering the last number early is legal but ends the path on the spot. Nobody falls for that twice.
      if (turn === topology.end) continue;
      const result = solveZip(shape, { prefix: [...prefix, turn], maxSolutions: 1, maxNodes: REFUTATION_CAP }, topology);
      if (result.nodes <= OBVIOUS_NODES) continue;
      decision = true;
      if (!result.exhausted) report.score += WEIGHT.capped;
      else if (result.nodes > SHALLOW_NODES) report.score += WEIGHT.deep;
      else report.score += WEIGHT.shallow;
      if (result.nodes > SHALLOW_NODES) report.deepTraps++;
      else report.shallowTraps++;
    }
    if (decision) report.decisions++;
    prefix.push(solution[step]);
  }
  return report;
}
