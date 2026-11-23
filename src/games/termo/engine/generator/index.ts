import type { Difficulty } from "@/shared/engine/difficulty";
import { dateKeyToDayNumber, isDateKey } from "@/shared/engine/pacific-time";
import { createRng } from "@/shared/engine/prng";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { TERMO_TIERS } from "../config";
import { termoDailyVariantFromSpec } from "../daily";
import { type PuzzleSpec, TERMO_GENERATOR_VERSION, termoPuzzleId, termoSeeds } from "../seed";
import type { TermoPuzzle, TermoShape } from "../types";
import { EASY_POOL_SIZE, WORD_LENGTH, answerWords, isKnownWord } from "../words";

export { termoPuzzleId } from "../seed";

const shuffledRanks = (key: string, count: number): number[] => createRng(key).shuffle(Array.from({ length: count }, (_, rank) => rank));
const wrap = (value: number, size: number): number => ((value % size) + size) % size;

/** Cards the day's Dueto and Quarteto own in their deck: two and four, plus one spare for a card that has to be skipped. */
const VARIANT_BLOCK = 7;

/**
 * Words of the puzzles of a date: the daily Termo, and the day's Dueto and
 * Quarteto. They are dealt from shuffled decks of the answer list, so words do
 * not come back soon, and the three puzzles of one date never share a word.
 *
 * - The daily Termo takes one card a day from the main deck. The deck has 1514
 *   cards, so the daily word does not repeat for over four years.
 * - The Dueto and the Quarteto take the cards of their date from a second
 *   deck, seven in a row: the first two for the Dueto, the next four for the
 *   Quarteto. A card that equals the day's Termo is skipped, which is what the
 *   seventh card is for. That deck lasts 216 days.
 * - The easy tier is not part of the daily. A date seed that asks for it gets
 *   the first common word at or after the date's place in the main deck.
 *
 * Returns null for a seed that is not about a date.
 */
function datedRanks(spec: PuzzleSpec, boards: number, total: number, poolSize: number): number[] | null {
  const variant = termoDailyVariantFromSpec(spec);
  const date = isDateKey(spec.token) ? spec.token : variant?.date;
  if (!date) return null;
  const day = dateKeyToDayNumber(date);
  const main = shuffledRanks(`TERMO|deck|v${spec.version}`, total);
  const termo = main[wrap(day, total)];

  if (boards === 1) {
    if (poolSize === total) return [termo];
    for (let step = 0; step < total; step++) {
      const rank = main[wrap(day + step, total)];
      if (rank < poolSize) return [rank];
    }
    return [termo];
  }

  const deck = shuffledRanks(`TERMO|variants|v${spec.version}`, total);
  const cards = Array.from({ length: VARIANT_BLOCK }, (_, card) => deck[wrap(day * VARIANT_BLOCK + card, total)]).filter((rank) => rank !== termo);
  // Two boards are the Dueto. Anything larger is the Quarteto, which starts after the Dueto's cards.
  const from = boards === 2 ? 0 : 2;
  return cards.slice(from, from + boards);
}

/**
 * Version 1: the tier sets the number of words and the pool. A seed about a
 * date deals from the decks, see `datedRanks`. Any other seed draws distinct
 * words with its own randomness.
 */
function generateTermoV1(spec: PuzzleSpec): { answers: string[]; ranks: number[]; poolSize: number; maxGuesses: number } {
  const tier = TERMO_TIERS[spec.difficulty];
  const words = answerWords();
  const poolSize = tier.pool === "common" ? Math.min(EASY_POOL_SIZE, words.length) : words.length;
  let ranks = datedRanks(spec, tier.boards, words.length, poolSize);
  if (!ranks) {
    ranks = [];
    const rng = createRng(termoSeeds.rngKey(spec));
    while (ranks.length < tier.boards) {
      const rank = rng.int(poolSize);
      if (!ranks.includes(rank)) ranks.push(rank);
    }
  }
  return { answers: ranks.map((rank) => words[rank]), ranks, poolSize, maxGuesses: tier.maxGuesses };
}

const VERSIONS: Record<number, typeof generateTermoV1> = { 1: generateTermoV1 };

/**
 * Builds the puzzle for a spec. The output depends only on the spec and on the
 * answer list of that generator version: the PRNG is keyed by token, version
 * and difficulty. Termo has one board size, so a size in the spec must be 5.
 */
export function generateTermoFromSpec(spec: PuzzleSpec): TermoPuzzle {
  if (!termoSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !termoSeeds.isBoardSize(spec.size)) throw new RangeError(`Word length ${spec.size} is out of range.`);

  const built = VERSIONS[spec.version](spec);
  const shareSeed = termoSeeds.format({ ...spec, token: normalizeToken(spec.token) });
  return {
    id: termoPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    difficulty: spec.difficulty,
    answers: built.answers,
    maxGuesses: built.maxGuesses,
    metadata: { generatorVersion: spec.version, shareSeed, poolSize: built.poolSize, ranks: built.ranks },
  };
}

export function generateTermoPuzzle(seed: string | number, difficulty: Difficulty, options: { version?: number } = {}): TermoPuzzle {
  return generateTermoFromSpec({ token: normalizeToken(seed), version: options.version ?? TERMO_GENERATOR_VERSION, difficulty });
}

export type PuzzleCheck = { ok: boolean; problems: string[] };

/** Independent check of a puzzle: every hidden word is a five-letter answer the game also takes as a guess, no word repeats, and there are more guesses than words. */
export function validateTermoPuzzle(puzzle: TermoShape & { difficulty?: Difficulty }): PuzzleCheck {
  const problems: string[] = [];
  const answers = new Set(answerWords());
  if (puzzle.answers.length === 0) problems.push("The puzzle has no hidden word.");
  for (const word of puzzle.answers) {
    if (!new RegExp(`^[a-z]{${WORD_LENGTH}}$`).test(word)) problems.push(`"${word}" is not five plain letters.`);
    else if (!answers.has(word)) problems.push(`"${word}" is not in the answer list.`);
    else if (!isKnownWord(word)) problems.push(`"${word}" cannot be typed as a guess.`);
  }
  if (new Set(puzzle.answers).size !== puzzle.answers.length) problems.push("A hidden word repeats.");
  if (puzzle.maxGuesses <= puzzle.answers.length) problems.push("There are not enough guesses to find every word.");
  if (puzzle.difficulty) {
    const tier = TERMO_TIERS[puzzle.difficulty];
    if (tier.boards !== puzzle.answers.length || tier.maxGuesses !== puzzle.maxGuesses) problems.push("The puzzle does not match its tier.");
  }
  return { ok: problems.length === 0, problems };
}
