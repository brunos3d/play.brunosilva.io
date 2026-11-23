import { neighboursOf } from "./grid";

/**
 * Thrown when a search uses more nodes than it was given. The generator treats
 * that board as rejected and builds another. A node count, never a clock, so
 * the same seed gives the same puzzle on every machine.
 */
export class SolverBudgetExceeded extends Error {
  constructor() {
    super("The Wend solver ran out of budget.");
  }
}

/** A set of cells as two 32-bit halves. Boards go up to 8 by 8, so 64 bits are enough. */
type Mask = readonly [number, number];
const bit = (cell: number): Mask => (cell < 32 ? [1 << cell, 0] : [0, 1 << (cell - 32)]);

export type Placement = { path: number[]; mask: Mask };

/**
 * Every way to trace a word on the board. Two traces over the same cells count
 * once: the game accepts a found word by the cells it covers, so they are the
 * same answer.
 */
export function findPlacements(size: number, letters: readonly string[], word: string, budget: { nodes: number }): Placement[] {
  const neighbours = neighboursOf(size);
  const found = new Map<string, Placement>();
  const path: number[] = [];
  let [low, high] = [0, 0];

  const walk = (cell: number, index: number): void => {
    if (--budget.nodes < 0) throw new SolverBudgetExceeded();
    const [cellLow, cellHigh] = bit(cell);
    path.push(cell);
    low |= cellLow;
    high |= cellHigh;
    if (index === word.length - 1) {
      const key = `${low >>> 0}:${high >>> 0}`;
      if (!found.has(key)) found.set(key, { path: [...path], mask: [low, high] });
    } else {
      for (const next of neighbours[cell]) {
        if (letters[next] !== word[index + 1]) continue;
        const [nextLow, nextHigh] = bit(next);
        if ((low & nextLow) !== 0 || (high & nextHigh) !== 0) continue;
        walk(next, index + 1);
      }
    }
    path.pop();
    low &= ~cellLow;
    high &= ~cellHigh;
  };

  for (let cell = 0; cell < letters.length; cell++) if (letters[cell] === word[0]) walk(cell, 0);
  return [...found.values()];
}

export type SolveResult = {
  /** Ways to fit every word on the board at once, counted up to `limit`. */
  count: number;
  /** The first way found: one path per word, in the order the words were given. */
  first: number[][] | null;
  nodes: number;
};

/**
 * Counts the ways to place all the words so that no two share a cell. The word
 * lengths add up to the number of letters on the board, so a set of disjoint
 * placements always covers every letter.
 *
 * Words with the fewest placements go first, and a branch is dropped as soon as
 * some word that is still waiting has no placement left.
 */
export function solveWend(size: number, letters: readonly string[], words: readonly string[], limit = 2, nodeLimit = 400_000): SolveResult {
  const budget = { nodes: nodeLimit };
  const placements = words.map((word) => findPlacements(size, letters, word, budget));
  const order = words.map((_, index) => index).sort((a, b) => placements[a].length - placements[b].length);
  const chosen: number[][] = new Array(words.length);
  let count = 0;
  let first: number[][] | null = null;

  const fits = (mask: Mask, low: number, high: number): boolean => (mask[0] & low) === 0 && (mask[1] & high) === 0;

  const place = (step: number, low: number, high: number): void => {
    if (count >= limit) return;
    if (step === order.length) {
      count++;
      if (!first) first = chosen.map((path) => [...path]);
      return;
    }
    // Look ahead: every word still to be placed needs at least one placement that is still free.
    for (let later = step + 1; later < order.length; later++) {
      if (!placements[order[later]].some((option) => fits(option.mask, low, high))) return;
    }
    const word = order[step];
    for (const option of placements[word]) {
      if (!fits(option.mask, low, high)) continue;
      if (--budget.nodes < 0) throw new SolverBudgetExceeded();
      chosen[word] = option.path;
      place(step + 1, low | option.mask[0], high | option.mask[1]);
      if (count >= limit) return;
    }
  };

  place(0, 0, 0);
  return { count, first, nodes: nodeLimit - budget.nodes };
}
