import { neighboursOf } from "./rules";
import type { Merge } from "./types";

/**
 * Solver for Sumbreak positions.
 *
 * One observation makes the search small. The smallest number on the board can
 * only merge with itself, and a merge of larger numbers never helps it: tiles do
 * not move, so emptying a cell elsewhere cannot bring two small tiles together.
 * Any solution can therefore be reordered so that the smallest numbers merge
 * first. The solver only ever tries merges of the smallest number present, and
 * that is still a complete search.
 *
 * Three facts cut dead positions early:
 * - the smallest number needs an even count, since its tiles pair up,
 * - the tiles must form one connected group, since two groups can never meet,
 * - every tile of the smallest number needs an equal neighbour, now.
 *
 * The budget is a node count, never a clock, so the answer is the same on every
 * machine.
 */
export type DeadReason = "odd-count" | "split" | "lonely" | "search";

export class SolverBudgetExceeded extends Error {}

export class SumbreakSolver {
  nodes = 0;
  private readonly neighbours: number[][];
  /** Positions already known to be dead ends. */
  private readonly dead = new Set<string>();
  private readonly chances = new Map<string, number>();

  constructor(
    readonly size: number,
    private readonly nodeLimit = Number.POSITIVE_INFINITY,
  ) {
    this.neighbours = neighboursOf(size);
  }

  /** The smallest number on the board and how many tiles hold it, plus the total number of tiles. */
  private smallest(cells: readonly number[]): { value: number; count: number; tiles: number } {
    let value = 0;
    let count = 0;
    let tiles = 0;
    for (const cell of cells) {
      if (cell === 0) continue;
      tiles++;
      if (value === 0 || cell < value) {
        value = cell;
        count = 1;
      } else if (cell === value) count++;
    }
    return { value, count, tiles };
  }

  private connected(cells: readonly number[], tiles: number): boolean {
    const start = cells.findIndex((value) => value !== 0);
    const seen = new Uint8Array(cells.length);
    const stack = [start];
    seen[start] = 1;
    let reached = 0;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      reached++;
      for (const next of this.neighbours[cell]) {
        if (cells[next] !== 0 && seen[next] === 0) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    return reached === tiles;
  }

  /** Why a position cannot be finished, judged without searching. Null when nothing obvious rules it out. */
  quickDeadReason(cells: readonly number[]): Exclude<DeadReason, "search"> | null {
    const { value, count, tiles } = this.smallest(cells);
    if (tiles <= 1) return null;
    if (count % 2 === 1) return "odd-count";
    if (!this.connected(cells, tiles)) return "split";
    for (let cell = 0; cell < cells.length; cell++) {
      if (cells[cell] === value && !this.neighbours[cell].some((next) => cells[next] === value)) return "lonely";
    }
    return null;
  }

  /** Merges of the smallest number, both directions of each pair. */
  private candidates(cells: readonly number[], value: number): Merge[] {
    const merges: Merge[] = [];
    for (let from = 0; from < cells.length; from++) {
      if (cells[from] !== value) continue;
      for (const to of this.neighbours[from]) if (cells[to] === value) merges.push({ from, to });
    }
    return merges;
  }

  private visit(): void {
    if (++this.nodes > this.nodeLimit) throw new SolverBudgetExceeded("node budget exceeded");
  }

  private search(cells: number[], line: Merge[]): boolean {
    const { value, tiles } = this.smallest(cells);
    if (tiles === 1) return true;
    if (this.quickDeadReason(cells) !== null) return false;
    const key = cells.join(",");
    if (this.dead.has(key)) return false;
    this.visit();
    for (const merge of this.candidates(cells, value)) {
      cells[merge.to] = value * 2;
      cells[merge.from] = 0;
      line.push(merge);
      const solved = this.search(cells, line);
      cells[merge.to] = value;
      cells[merge.from] = value;
      if (solved) return true;
      line.pop();
    }
    this.dead.add(key);
    return false;
  }

  /** One order of merges that leaves a single tile, or null when there is none. */
  solve(cells: readonly number[]): Merge[] | null {
    const line: Merge[] = [];
    return this.search([...cells], line) ? line : null;
  }

  isSolvable(cells: readonly number[]): boolean {
    return this.solve(cells) !== null;
  }

  /**
   * Chance that a careful but aimless player ends with one tile. At every step
   * the player picks evenly among the merges of the smallest number, leaving out
   * the ones whose result is dead at a glance (an odd count, a stranded tile, two
   * groups). What is left are the traps that take thought to see, so the value
   * tracks how hard a board feels: about 0.5 for LinkedIn's first 3x3 and 0.05
   * for its first 4x4.
   */
  winChance(cells: readonly number[]): number {
    return this.chance([...cells]);
  }

  private chance(cells: number[]): number {
    const { value, tiles } = this.smallest(cells);
    if (tiles === 1) return 1;
    if (this.quickDeadReason(cells) !== null) return 0;
    const key = cells.join(",");
    const known = this.chances.get(key);
    if (known !== undefined) return known;
    this.visit();
    let total = 0;
    let choices = 0;
    for (const merge of this.candidates(cells, value)) {
      cells[merge.to] = value * 2;
      cells[merge.from] = 0;
      if (this.quickDeadReason(cells) === null) {
        total += this.chance(cells);
        choices++;
      }
      cells[merge.to] = value;
      cells[merge.from] = value;
    }
    const result = choices === 0 ? 0 : total / choices;
    this.chances.set(key, result);
    return result;
  }

  /** How many merges of the smallest number there are, and how many of them leave a board that can still be finished. */
  options(cells: readonly number[]): { total: number; alive: number } {
    const board = [...cells];
    const { value } = this.smallest(board);
    let alive = 0;
    const merges = this.candidates(board, value);
    for (const merge of merges) {
      board[merge.to] = value * 2;
      board[merge.from] = 0;
      if (this.search(board, [])) alive++;
      board[merge.to] = value;
      board[merge.from] = value;
    }
    return { total: merges.length, alive };
  }
}

/** One-off checks for callers that do not keep a solver around. */
export function solveSumbreak(size: number, cells: readonly number[], nodeLimit?: number): Merge[] | null {
  return new SumbreakSolver(size, nodeLimit).solve(cells);
}
