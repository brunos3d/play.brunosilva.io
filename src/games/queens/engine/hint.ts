import { MARK, QUEEN, queensOf } from "./game/state";
import type { Topology, UnitKind } from "./grid";
import { type DeductionStep, createKnowledge, nextStep } from "./solver/logic";
import type { Technique } from "./types";

/** A region, a row or a column, by kind and zero-based index. */
export type UnitRef = { kind: UnitKind; index: number };

/**
 * Why a hint holds, as data: the technique and the groups it talks about.
 * ./text.ts turns it into the sentence the player reads.
 */
export type HintReason =
  /** `unit` has one free cell left. */
  | { code: "single"; unit: UnitRef }
  /** Every free cell of `region` is in `line`. */
  | { code: "confined-region"; region: number; line: UnitRef }
  /** Every free cell of `line` is in `region`. */
  | { code: "confined-line"; region: number; line: UnitRef }
  /** A queen on any of the `cells` eliminated cells would leave `unit` without a free cell. */
  | { code: "blocker"; unit: UnitRef; cells: number }
  /** `regions` have all their free cells in `lines`. Both lists hold two or more, and the lines are all rows or all columns. */
  | { code: "region-group"; regions: number[]; lines: UnitRef[] }
  /** `lines` only have free cells in `regions`. Both lists hold two or more, and the lines are all rows or all columns. */
  | { code: "line-group"; regions: number[]; lines: UnitRef[] }
  /** A queen on the eliminated cell forces a chain of queens that leaves `unit` without a free cell. */
  | { code: "trial"; unit: UnitRef }
  /** No deduction was found, so the queen of `region` comes straight from the solution. */
  | { code: "solution"; region: number };

/** What a hint does, as data. ./text.ts turns it into the sentence the player reads. */
export type QueensHint =
  /** A queen that is not part of the solution. It comes off. */
  | { kind: "wrong-queen"; cell: number }
  /** An X on a cell where a queen has to go. It comes off. */
  | { kind: "wrong-mark"; cell: number }
  /** The next queen deduction can place. `highlight` is the group it was found in. */
  | { kind: "place"; cell: number; highlight: number[]; technique: Technique; reason: HintReason }
  /** Cells deduction rules out. They get an X. `highlight` is the group or groups the reason talks about. */
  | { kind: "eliminate"; cells: number[]; highlight: number[]; technique: Technique; reason: HintReason }
  | { kind: "complete" };

function reasonOf(topology: Topology, step: DeductionStep): HintReason {
  const ref = (unit: number): UnitRef => ({ kind: topology.units[unit].kind, index: topology.units[unit].index });
  switch (step.technique) {
    case "single":
    case "trial":
      return { code: step.technique, unit: ref(step.units[0]) };
    case "confined-region":
    case "confined-line":
      return { code: step.technique, region: topology.units[step.units[0]].index, line: ref(step.lines[0]) };
    case "blocker":
      return { code: "blocker", unit: ref(step.units[0]), cells: step.eliminate.length };
    case "region-group":
    case "line-group":
      return { code: step.technique, regions: step.units.map((unit) => topology.units[unit].index), lines: step.lines.map(ref) };
  }
}

/**
 * Next step for the player. A mistake is reported before anything else,
 * because deduction on top of a wrong queen or a wrong X would lead further
 * astray. Otherwise the deduction solver looks at the board as the player left
 * it (placed queens and X's count as known) and returns its easiest step.
 * Generated puzzles have one solution, proven by search and reached by
 * deduction, so a hint is never a guess.
 */
export function getQueensHint(topology: Topology, solution: readonly number[], marks: readonly number[]): QueensHint {
  const wanted = new Set(solution);
  const queens = queensOf(marks);

  const wrongQueen = queens.find((cell) => !wanted.has(cell));
  if (wrongQueen !== undefined) return { kind: "wrong-queen", cell: wrongQueen };
  const wrongMark = solution.find((cell) => marks[cell] === MARK);
  if (wrongMark !== undefined) return { kind: "wrong-mark", cell: wrongMark };
  if (queens.length === topology.size) return { kind: "complete" };

  const excluded: number[] = [];
  for (let cell = 0; cell < marks.length; cell++) if (marks[cell] === MARK) excluded.push(cell);
  const knowledge = createKnowledge(topology, queens, excluded);
  const step = nextStep(topology, knowledge);
  if (!step) {
    // Every board ships with a full deduction path, so this is only reached if that path is lost. Fall back to the solution itself.
    const cell = solution.find((candidate) => marks[candidate] !== QUEEN)!;
    const region = topology.units[topology.regionOf[cell]];
    return { kind: "place", cell, highlight: [...region.cells], technique: "single", reason: { code: "solution", region: region.index } };
  }

  const free = (unit: number) => topology.units[unit].cells.filter((cell) => knowledge.free[cell] === 1);
  const highlight = [...new Set([...step.units, ...(step.technique === "confined-line" || step.technique === "line-group" ? step.lines : [])].flatMap(free))];
  const reason = reasonOf(topology, step);
  if (step.place !== null) return { kind: "place", cell: step.place, highlight, technique: step.technique, reason };
  return { kind: "eliminate", cells: step.eliminate, highlight, technique: step.technique, reason };
}
