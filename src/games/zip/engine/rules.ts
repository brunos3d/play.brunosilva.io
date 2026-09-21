import { type Topology, areAdjacent, wallKey } from "./grid";

export type MoveErrorCode = "start-at-one" | "not-adjacent" | "wall" | "revisit" | "wrong-number" | "path-ended";

export type MoveError = { code: MoveErrorCode; message: string };

/** The number the path has to reach next, given the cells it already holds. */
export function nextNumber(topology: Topology, path: readonly number[]): number {
  let last = 0;
  for (const cell of path) {
    if (topology.numberAt[cell] > last) last = topology.numberAt[cell];
  }
  return last + 1;
}

/**
 * Can the path grow into `cell`? Returns null when it can, or the rule that
 * stops it. These are the rules of the game, in one place:
 * start on 1, move to a side neighbour, never through a wall, never onto the
 * path, and take the numbers in order.
 */
export function checkStep(topology: Topology, path: readonly number[], cell: number): MoveError | null {
  if (path.length === 0) {
    return cell === topology.start ? null : { code: "start-at-one", message: "The path starts on 1." };
  }
  const head = path[path.length - 1];
  if (topology.numberAt[head] === topology.lastNumber) {
    return { code: "path-ended", message: `The path ends on ${topology.lastNumber}. Back up and cover the empty cells first.` };
  }
  if (!areAdjacent(topology.width, head, cell)) return { code: "not-adjacent", message: "Move to a cell next to the end of the path." };
  if (topology.walls.has(wallKey(head, cell))) return { code: "wall", message: "A wall blocks the way." };
  if (path.includes(cell)) return { code: "revisit", message: "The path cannot cross itself." };

  const number = topology.numberAt[cell];
  if (number !== 0) {
    const expected = nextNumber(topology, path);
    if (number !== expected) return { code: "wrong-number", message: `Reach ${expected} before ${number}.` };
  }
  return null;
}

export type PathValidation = { complete: boolean; error: string | null; uncovered: number[] };

/**
 * Full check of a path, from scratch. Completion is decided here and nowhere
 * else: every cell once, every step legal, every number in order, ending on
 * the last number.
 */
export function validatePath(topology: Topology, path: readonly number[]): PathValidation {
  const seen = new Set<number>();
  const walked: number[] = [];
  for (const cell of path) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= topology.cellCount) return { complete: false, error: "The path leaves the board.", uncovered: [] };
    const error = checkStep(topology, walked, cell);
    if (error) return { complete: false, error: error.message, uncovered: [] };
    walked.push(cell);
    seen.add(cell);
  }
  const uncovered: number[] = [];
  for (let cell = 0; cell < topology.cellCount; cell++) if (!seen.has(cell)) uncovered.push(cell);
  const endsOnLast = path.length > 0 && path[path.length - 1] === topology.end;
  return { complete: uncovered.length === 0 && endsOnLast, error: null, uncovered };
}
