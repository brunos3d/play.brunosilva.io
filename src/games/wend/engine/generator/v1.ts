import { dateKeyToDayNumber, isDateKey } from "@/shared/engine/pacific-time";
import { type Rng, createRng } from "@/shared/engine/prng";
import { WEND_MAX_WORD, WEND_TIERS, type WendTier } from "../config";
import { countBends, neighboursOf } from "../grid";
import { type PuzzleSpec, wendSeeds } from "../seed";
import { SolverBudgetExceeded, solveWend } from "../solver";
import { type BankWord, type Theme, wendThemes } from "../themes";
import type { WendWord } from "../types";

export type GeneratedBoard = {
  size: number;
  letters: string[];
  words: WendWord[];
  theme: string;
  attempts: number;
  solverNodes: number;
  walls: number;
  bendiness: number;
};

/** Boards tried on one theme before the next theme gets its turn. */
const TRIES_PER_THEME = 16;
/** Work one uniqueness check may spend. A board that needs more is thrown away. */
const NODE_BUDGET = 150_000;
/** Shortest word the bank holds. */
const MIN_WORD = 3;

/**
 * The themes in the order this seed tries them. A daily seed (its token is a
 * date) walks through one shuffled deck of all themes, one card a day, and
 * starts over at the end, so a theme comes back only after all the others had
 * their day. Any other seed shuffles the deck with its own randomness.
 */
function themeOrder(spec: PuzzleSpec, rng: Rng): number[] {
  const indices = wendThemes().map((_, index) => index);
  if (!isDateKey(spec.token)) return rng.shuffle(indices);
  const day = dateKeyToDayNumber(spec.token);
  const deck = createRng(`WEND|themes|v${spec.version}`).shuffle(indices);
  const start = ((day % indices.length) + indices.length) % indices.length;
  // The fallbacks start half a deck away. The next cards belong to the coming days, and a theme that cannot fill today's board should not take one of them.
  const far = (start + Math.floor(indices.length / 2)) % indices.length;
  const rest = [...deck.slice(far), ...deck.slice(0, far)].filter((index) => index !== deck[start]);
  return [deck[start], ...rest];
}

/**
 * How strict the choice of word lengths is, from the strictest pass to the
 * loosest. Distinct lengths come first, as in the original game, where the
 * list reads "5, 6, 7, 8, 9 and 10 letters". A theme with too few long words
 * may use a length twice. The two loosest passes exist for a board size picked
 * by hand that the tier's own recipe cannot fill.
 */
function passes(tier: WendTier): { count: readonly [number, number]; lengths: readonly [number, number]; repeat: number }[] {
  return [
    { count: tier.words, lengths: tier.lengths, repeat: 1 },
    { count: tier.words, lengths: tier.lengths, repeat: 2 },
    { count: [2, 12], lengths: tier.lengths, repeat: 2 },
    { count: [2, 16], lengths: [MIN_WORD, WEND_MAX_WORD], repeat: 3 },
  ];
}
/**
 * The order the passes run in. A theme tries passes 0 and 1 before the next
 * theme gets its turn, so the theme the seed asked for wins over tidy lengths.
 * Only when no theme fits does the search loosen further.
 */
const PASS_GROUPS = [[0, 1], [2], [3]] as const;

/** Word lengths for a board: they add up to the number of letters, and the theme has a word for each. Null when the theme cannot fill the board at this pass. */
function planLengths(rng: Rng, theme: Theme, tier: WendTier, size: number, passIndex: number): number[] | null {
  const cells = size * size;
  const pass = passes(tier)[passIndex];
  const options: number[] = [];
  for (let length = pass.lengths[0]; length <= pass.lengths[1]; length++) {
    const stock = Math.min(pass.repeat, theme.byLength.get(length)?.length ?? 0);
    for (let copy = 0; copy < stock; copy++) options.push(length);
  }
  const [low, high] = [cells - tier.walls[1], cells - tier.walls[0]];
  const plans: number[][] = [];
  const picked: number[] = [];
  const visit = (from: number, sum: number): void => {
    if (plans.length >= 400) return;
    if (sum >= low && sum <= high && picked.length >= pass.count[0]) plans.push([...picked]);
    if (picked.length >= pass.count[1]) return;
    for (let index = from; index < options.length; index++) {
      // Equal lengths sit next to each other. Skipping a repeat at the same depth keeps each multiset once.
      if (index > from && options[index] === options[index - 1]) continue;
      if (sum + options[index] > high) break;
      picked.push(options[index]);
      visit(index + 1, sum + options[index]);
      picked.pop();
    }
  };
  visit(0, 0);
  return plans.length > 0 ? rng.pick(plans) : null;
}

function pickWords(rng: Rng, theme: Theme, lengths: readonly number[]): BankWord[] {
  const decks = new Map<number, BankWord[]>();
  return lengths.map((length) => {
    let deck = decks.get(length);
    if (!deck) decks.set(length, (deck = rng.shuffle(theme.byLength.get(length) ?? [])));
    return deck.pop() as BankWord;
  });
}

/**
 * One path through every cell. It starts as rows walked back and forth, turned
 * or mirrored at random, and is then scrambled by backbiting: pick an end, pick
 * a neighbour of it that is not next to it on the path, and reverse the stretch
 * between the two. Every move keeps it a path through every cell and changes a
 * single step, so the number of moves sets how winding the words become.
 */
function fullPath(rng: Rng, size: number, moves: number): number[] {
  const [transpose, flipRows, flipColumns] = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)];
  const path: number[] = [];
  for (let row = 0; row < size; row++) {
    for (let step = 0; step < size; step++) {
      let [r, c] = [row, row % 2 === 0 ? step : size - 1 - step];
      if (transpose) [r, c] = [c, r];
      if (flipRows) r = size - 1 - r;
      if (flipColumns) c = size - 1 - c;
      path.push(r * size + c);
    }
  }
  const neighbours = neighboursOf(size);
  const position = new Int32Array(path.length);
  path.forEach((cell, index) => (position[cell] = index));
  const reverse = (from: number, to: number): void => {
    for (let i = from, j = to; i < j; i++, j--) {
      [path[i], path[j]] = [path[j], path[i]];
      position[path[i]] = i;
      position[path[j]] = j;
    }
  };
  for (let move = 0; move < moves; move++) {
    const atTail = rng.chance(0.5);
    const end = atTail ? path[path.length - 1] : path[0];
    const beside = atTail ? path[path.length - 2] : path[1];
    const options = neighbours[end].filter((cell) => cell !== beside);
    if (options.length === 0) continue;
    const index = position[rng.pick(options)];
    if (atTail) reverse(index + 1, path.length - 1);
    else reverse(0, index - 1);
  }
  return path;
}

/** Splits `total` walls over `slots` places, each split equally likely to grow. */
function scatter(rng: Rng, total: number, slots: number): number[] {
  const counts = new Array<number>(slots).fill(0);
  for (let wall = 0; wall < total; wall++) counts[rng.int(slots)]++;
  return counts;
}

function build(rng: Rng, theme: Theme, tier: WendTier, size: number, pass: number): Omit<GeneratedBoard, "attempts" | "solverNodes"> | null {
  const lengths = planLengths(rng, theme, tier, size, pass);
  if (!lengths) return null;
  const bank = rng.shuffle(pickWords(rng, theme, lengths));
  const cells = size * size;
  const walls = cells - lengths.reduce((sum, length) => sum + length, 0);
  const path = fullPath(rng, size, Math.round(tier.mixing * cells));

  // The path is cut into the words, one after the other. A wall is a cell the cut skips, before, between or after words.
  const gaps = scatter(rng, walls, bank.length + 1);
  const letters = new Array<string>(cells).fill("");
  const words: WendWord[] = [];
  let at = 0;
  let bends = 0;
  bank.forEach((word, index) => {
    at += gaps[index];
    const stretch = path.slice(at, at + word.text.length);
    at += word.text.length;
    if (rng.chance(0.5)) stretch.reverse();
    stretch.forEach((cell, letter) => (letters[cell] = word.text[letter]));
    bends += countBends(stretch);
    words.push({ text: word.text, display: word.display, path: stretch });
  });
  words.sort((a, b) => a.text.length - b.text.length || (a.text < b.text ? -1 : 1));
  return { size, letters, words, theme: theme.title, walls, bendiness: bends / (cells - walls) };
}

/**
 * Generator v1. Picks a theme, picks words whose lengths fill the board, lays
 * them along one scrambled path, and keeps the board only if the words fit in
 * exactly one way. Each try has its own random stream, so the result depends on
 * the seed alone.
 */
export function generateWendV1(spec: PuzzleSpec): GeneratedBoard {
  const key = wendSeeds.rngKey(spec);
  const rng = createRng(key);
  const tier = WEND_TIERS[spec.difficulty];
  const size = spec.size ?? rng.pick(tier.sizes);
  const order = themeOrder(spec, rng);
  const themes = wendThemes();

  let attempt = 0;
  for (const group of PASS_GROUPS) {
    for (const index of order) {
      for (const pass of group) {
        for (let attemptOnTheme = 0; attemptOnTheme < TRIES_PER_THEME; attemptOnTheme++) {
          const board = build(createRng(`${key}|try${attempt++}`), themes[index], tier, size, pass);
          // No set of this theme's words fills the board at this pass.
          if (!board) break;
          try {
            const solved = solveWend(
              size,
              board.letters,
              board.words.map((word) => word.text),
              2,
              NODE_BUDGET,
            );
            if (solved.count === 1) return { ...board, attempts: attempt, solverNodes: solved.nodes };
          } catch (error) {
            if (!(error instanceof SolverBudgetExceeded)) throw error;
          }
        }
      }
    }
  }
  throw new Error("No board with a single solution came up for this seed.");
}
