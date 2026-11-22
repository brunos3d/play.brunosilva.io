import { MARK, QUEEN, queensOf } from "./game/state";
import type { Topology, Unit } from "./grid";
import { type DeductionStep, createKnowledge, nextStep } from "./solver/logic";
import type { Technique } from "./types";

export type QueensHint =
  /** A queen that is not part of the solution. It comes off. */
  | { kind: "wrong-queen"; cell: number; message: string }
  /** An X on a cell where a queen has to go. It comes off. */
  | { kind: "wrong-mark"; cell: number; message: string }
  /** The next queen deduction can place. `highlight` is the group it was found in. */
  | { kind: "place"; cell: number; highlight: number[]; technique: Technique; message: string }
  /** Cells deduction rules out. They get an X. `highlight` is the group or groups the reason talks about. */
  | { kind: "eliminate"; cells: number[]; highlight: number[]; technique: Technique; message: string }
  | { kind: "complete"; message: string };

/** How a region, row or column is called in a sentence. The board passes one that names regions by colour. */
export type UnitNamer = (unit: Unit) => string;

export const defaultUnitName: UnitNamer = (unit) => `${unit.kind} ${unit.index + 1}`;

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const list = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** "row 3", "rows 2 and 3", "columns 1, 4 and 5". */
function nameLines(topology: Topology, lines: readonly number[]): string {
  const units = lines.map((line) => topology.units[line]);
  const kind = units[0].kind;
  return units.length === 1 ? `${kind} ${units[0].index + 1}` : `${kind}s ${list(units.map((unit) => String(unit.index + 1)))}`;
}

function describe(topology: Topology, step: DeductionStep, name: UnitNamer): string {
  const units = step.units.map((unit) => topology.units[unit]);
  const many = step.eliminate.length > 1;
  switch (step.technique) {
    case "single":
      return `${capitalize(name(units[0]))} has one free cell left, so its queen goes there.`;
    case "confined-region":
      return `Every free cell of ${name(units[0])} is in ${nameLines(topology, step.lines)}, so its queen takes that ${topology.units[step.lines[0]].kind}. No other cell there can hold one.`;
    case "confined-line":
      return `Every free cell of ${nameLines(topology, step.lines)} is in ${name(units[0])}, so that region's queen is there. Its other cells are out.`;
    case "blocker":
      return `A queen on ${many ? "any of these cells" : "this cell"} would rule out every free cell of ${name(units[0])}.`;
    case "region-group":
      return `${capitalize(list(units.map(name)))} have all their free cells in ${nameLines(topology, step.lines)}. They take every queen there, so no other region can use those ${topology.units[step.lines[0]].kind}s.`;
    case "line-group":
      return `${capitalize(nameLines(topology, step.lines))} only have free cells in ${list(units.map(name))}. Those regions place their queens there, so their cells elsewhere are out.`;
    case "trial":
      return `A queen on this cell forces other queens one after another, and ${name(units[0])} ends up with no free cell.`;
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
export function getQueensHint(topology: Topology, solution: readonly number[], marks: readonly number[], name: UnitNamer = defaultUnitName): QueensHint {
  const wanted = new Set(solution);
  const queens = queensOf(marks);

  const wrongQueen = queens.find((cell) => !wanted.has(cell));
  if (wrongQueen !== undefined) return { kind: "wrong-queen", cell: wrongQueen, message: "This queen is in the wrong place. With it there the board cannot be finished, so it comes off." };
  const wrongMark = solution.find((cell) => marks[cell] === MARK);
  if (wrongMark !== undefined) return { kind: "wrong-mark", cell: wrongMark, message: "This X is on a cell that needs a queen, so it comes off." };
  if (queens.length === topology.size) return { kind: "complete", message: "The board is complete." };

  const excluded: number[] = [];
  for (let cell = 0; cell < marks.length; cell++) if (marks[cell] === MARK) excluded.push(cell);
  const knowledge = createKnowledge(topology, queens, excluded);
  const step = nextStep(topology, knowledge);
  if (!step) {
    // Every board ships with a full deduction path, so this is only reached if that path is lost. Fall back to the solution itself.
    const cell = solution.find((candidate) => marks[candidate] !== QUEEN)!;
    const region = topology.units[topology.regionOf[cell]];
    return { kind: "place", cell, highlight: [...region.cells], technique: "single", message: `The queen of ${name(region)} goes here.` };
  }

  const free = (unit: number) => topology.units[unit].cells.filter((cell) => knowledge.free[cell] === 1);
  const highlight = [...new Set([...step.units, ...(step.technique === "confined-line" || step.technique === "line-group" ? step.lines : [])].flatMap(free))];
  const message = describe(topology, step, name);
  if (step.place !== null) return { kind: "place", cell: step.place, highlight, technique: step.technique, message };
  return { kind: "eliminate", cells: step.eliminate, highlight, technique: step.technique, message };
}
