import { type Topology, areAdjacent, wallKey } from "./grid";

export type MoveErrorCode = "start-at-one" | "blocked" | "not-adjacent" | "wall" | "revisit" | "wrong-number" | "path-ended";

/**
 * Why a step is refused, as data: the rule that stops it and the numbers its
 * sentence needs. The sentence itself is built in ./text.ts, in the player's
 * language.
 */
export type MoveError = { code: MoveErrorCode; values?: Record<string, number>; /** For "wrong-number": the board hides numbers, so the sentence must not give a position away. */ hidden?: boolean };

/**
 * The number the path has to reach next: one more than the numbered cells it
 * already holds. Counting cells, not reading numbers, is what makes hidden
 * numbers work: a "?" on the path still counts as one.
 */
export function nextNumber(topology: Topology, path: readonly number[]): number {
  let count = 0;
  for (const cell of path) if (topology.numberAt[cell] !== 0) count++;
  return count + 1;
}

/**
 * Can the path grow into `cell`? Returns null when it can, or the rule that
 * stops it. These are the rules of the game, in one place:
 * start on 1, move to a side neighbour, never through a wall, never onto the
 * path or a blocked cell, and take the numbers in order.
 *
 * "In order" is checked by position: a visible number n must be the nth
 * numbered cell on the path. A hidden number ("?") fits any position, because
 * the player cannot know its number, and refusing the step would give it away.
 * The generator only hides a number when the solution stays unique under this
 * looser rule.
 */
export function checkStep(topology: Topology, path: readonly number[], cell: number): MoveError | null {
  if (topology.blockedAt[cell]) return { code: "blocked" };
  if (path.length === 0) {
    return cell === topology.start ? null : { code: "start-at-one" };
  }
  const head = path[path.length - 1];
  if (topology.numberAt[head] === topology.lastNumber) {
    return { code: "path-ended", values: { last: topology.lastNumber } };
  }
  if (!areAdjacent(topology.width, head, cell)) return { code: "not-adjacent" };
  if (topology.walls.has(wallKey(head, cell))) return { code: "wall" };
  if (path.includes(cell)) return { code: "revisit" };

  const number = topology.numberAt[cell];
  if (number !== 0 && !topology.hiddenAt[cell]) {
    const position = nextNumber(topology, path);
    if (number !== position) {
      return { code: "wrong-number", values: { number, position }, hidden: topology.hiddenAt.some((flag) => flag === 1) };
    }
  }
  return null;
}

export type PathValidation = { complete: boolean; /** The first rule the path breaks, or "off-board" for a cell that does not exist. */ error: MoveErrorCode | "off-board" | null; uncovered: number[] };

/**
 * Full check of a path, from scratch. Completion is decided here and nowhere
 * else: every cell once, every step legal, every number in order, ending on
 * the last number.
 */
export function validatePath(topology: Topology, path: readonly number[]): PathValidation {
  const seen = new Set<number>();
  const walked: number[] = [];
  for (const cell of path) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= topology.cellCount) return { complete: false, error: "off-board", uncovered: [] };
    const error = checkStep(topology, walked, cell);
    if (error) return { complete: false, error: error.code, uncovered: [] };
    walked.push(cell);
    seen.add(cell);
  }
  const uncovered: number[] = [];
  for (let cell = 0; cell < topology.cellCount; cell++) if (!seen.has(cell) && !topology.blockedAt[cell]) uncovered.push(cell);
  const endsOnLast = path.length > 0 && path[path.length - 1] === topology.end;
  return { complete: uncovered.length === 0 && endsOnLast, error: null, uncovered };
}
