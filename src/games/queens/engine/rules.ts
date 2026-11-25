import { type Topology, columnOf, rowOf } from "./grid";
import type { QueensShape } from "./types";

/**
 * The rules of Queens, in one place.
 *
 * 1. Every row holds exactly one queen.
 * 2. Every column holds exactly one queen.
 * 3. Every coloured region holds exactly one queen.
 * 4. Two queens never touch, diagonals included.
 *
 * A board is solved when it holds one queen per row and no rule is broken.
 */
export type RuleId = "same-row" | "same-column" | "same-region" | "touching";

/**
 * Why a queen is refused, as data: the rule it breaks and the queen already on
 * the board that it breaks it with. The sentence is built in ./text.ts, in the
 * player's language.
 */
export type MoveError = { rule: RuleId; /** The queen already on the board that refuses the new one. */ with: number };

/** The rule two queens on these cells break, or null when they can share a board. */
export function ruleBetween(topology: Topology, a: number, b: number): RuleId | null {
  const { size } = topology;
  const rows = Math.abs(rowOf(size, a) - rowOf(size, b));
  const columns = Math.abs(columnOf(size, a) - columnOf(size, b));
  if (rows === 0) return "same-row";
  if (columns === 0) return "same-column";
  if (topology.regionOf[a] === topology.regionOf[b]) return "same-region";
  if (rows <= 1 && columns <= 1) return "touching";
  return null;
}

/** Null when a queen may go on `cell`, otherwise the first rule a queen already on the board breaks with it. */
export function checkQueen(topology: Topology, queens: readonly number[], cell: number): MoveError | null {
  for (const queen of queens) {
    if (queen === cell) continue;
    const rule = ruleBetween(topology, queen, cell);
    if (rule) return { rule, with: queen };
  }
  return null;
}

export type BoardCheck = {
  /** One queen per row, column and region, none touching. */
  complete: boolean;
  /** Pairs of queens that break a rule. Empty on any board the game itself produced. */
  conflicts: { a: number; b: number; rule: RuleId }[];
};

/** Checks a whole set of queens from scratch. The only completion check in the game. */
export function validateQueens(topology: Topology, queens: readonly number[]): BoardCheck {
  const conflicts: BoardCheck["conflicts"] = [];
  const distinct = new Set(queens);
  const list = [...distinct];
  for (let i = 0; i < list.length; i++) {
    if (!Number.isInteger(list[i]) || list[i] < 0 || list[i] >= topology.cellCount) return { complete: false, conflicts: [{ a: list[i], b: list[i], rule: "same-row" }] };
    for (let j = i + 1; j < list.length; j++) {
      const rule = ruleBetween(topology, list[i], list[j]);
      if (rule) conflicts.push({ a: list[i], b: list[j], rule });
    }
  }
  // Without conflicts, `size` queens fill every row and column, and every region when the board has `size` regions.
  const complete = conflicts.length === 0 && distinct.size === queens.length && list.length === topology.size && topology.regionCount === topology.size;
  return { complete, conflicts };
}

/** Cells that placed queens rule out. The board draws them as faint marks. They are derived, never stored. */
export function ruledOutCells(topology: Topology, queens: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (const queen of queens) for (const cell of topology.attacks[queen]) out.add(cell);
  for (const queen of queens) out.delete(queen);
  return out;
}

/** Structural audit of a shape: `size` regions, each connected and non-empty. */
export function validateShape(shape: QueensShape): string[] {
  const { size, regions } = shape;
  const problems: string[] = [];
  if (regions.length !== size * size) return [`Expected ${size * size} cells, got ${regions.length}.`];
  const cells = new Map<number, number[]>();
  regions.forEach((region, cell) => cells.set(region, [...(cells.get(region) ?? []), cell]));
  if (cells.size !== size) problems.push(`Expected ${size} regions, got ${cells.size}.`);
  for (const [region, members] of cells) {
    if (!Number.isInteger(region) || region < 0 || region >= size) problems.push(`Region id ${region} is out of range.`);
    const inRegion = new Set(members);
    const seen = new Set([members[0]]);
    const queue = [members[0]];
    while (queue.length > 0) {
      const cell = queue.pop()!;
      const row = rowOf(size, cell);
      const column = columnOf(size, cell);
      for (const next of [row > 0 ? cell - size : -1, row < size - 1 ? cell + size : -1, column > 0 ? cell - 1 : -1, column < size - 1 ? cell + 1 : -1]) {
        if (next >= 0 && inRegion.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    if (seen.size !== members.length) problems.push(`Region ${region} is not connected.`);
  }
  return problems;
}
