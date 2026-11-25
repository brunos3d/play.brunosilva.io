import type { GameLanguage } from "@/i18n/game-language";
import type { DailyInfo } from "@/shared/engine/daily";
import type { Difficulty } from "@/shared/engine/difficulty";
import { type DateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { WEND_TIERS } from "../config";
import { WEND_DAILY_CONFIG, getWendDailyInfo } from "../daily";
import { cellSetKey, isPath } from "../grid";
import { type PuzzleSpec, WEND_GENERATOR_VERSION, wendLanguage, wendPuzzleId, wendSeeds } from "../seed";
import { SolverBudgetExceeded, solveWend } from "../solver";
import { type Theme, loadWendBank } from "../themes";
import type { WendPuzzle, WendShape } from "../types";
import { type GeneratedBoard, generateWendV1 } from "./v1";

const VERSIONS: Record<number, (spec: PuzzleSpec, themes?: readonly Theme[]) => GeneratedBoard> = { 1: generateWendV1 };

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version, difficulty, size and language, each try has its
 * own stream, and the solver works on a node budget, never on a clock.
 *
 * The words are in the language of the spec, and that language's bank must be
 * in memory: this function throws if it is not. The app calls `loadWendPuzzle`,
 * which fetches the bank first. `themes` stands in for the bank in tests.
 */
export function generateWendFromSpec(spec: PuzzleSpec, themes?: readonly Theme[]): WendPuzzle {
  if (!wendSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !wendSeeds.isBoardSize(spec.size)) throw new RangeError(`Board size ${spec.size} is out of range.`);

  const board = VERSIONS[spec.version](spec, themes);
  const shareSeed = wendSeeds.format({ ...spec, token: normalizeToken(spec.token) });
  return {
    id: wendPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    language: wendLanguage(spec),
    size: board.size,
    letters: board.letters,
    words: board.words,
    difficulty: spec.difficulty,
    theme: board.theme,
    themeShown: WEND_TIERS[spec.difficulty].themeShown,
    metadata: {
      generatorVersion: spec.version,
      shareSeed,
      attempts: board.attempts,
      solverNodes: board.solverNodes,
      walls: board.walls,
      bendiness: board.bendiness,
    },
  };
}

/**
 * Downloads the word bank of the spec's language, if it is not here yet, and
 * builds the puzzle. This is how the app generates: only the language being
 * played is ever fetched.
 */
export async function loadWendPuzzle(spec: PuzzleSpec): Promise<WendPuzzle> {
  await loadWendBank(wendLanguage(spec));
  return generateWendFromSpec(spec);
}

/** Portuguese unless `language` says otherwise, as a seed without a language is. */
export function generateWendPuzzle(seed: string | number, difficulty: Difficulty, options: { size?: number; version?: number; language?: GameLanguage | null } = {}): WendPuzzle {
  const spec: PuzzleSpec = { token: normalizeToken(seed), version: options.version ?? WEND_GENERATOR_VERSION, difficulty, ...(options.size !== undefined ? { size: options.size } : {}) };
  return generateWendFromSpec(wendSeeds.withLanguage(spec, options.language));
}

/** Daily puzzle of a language for a Pacific calendar date, or for the Pacific date of an instant. Portuguese when no language is given. */
export function getWendDailyPuzzle(when: DateKey | Date, language?: GameLanguage | null, config = WEND_DAILY_CONFIG): { info: DailyInfo; puzzle: WendPuzzle } {
  const date = typeof when === "string" ? when : pacificDateKey(when);
  const info = getWendDailyInfo(date, language, config);
  return { info, puzzle: generateWendFromSpec(info.spec) };
}

export type PuzzleCheck = { ok: boolean; problems: string[] };

/**
 * Independent check of a finished puzzle: every stored path is a real path that
 * spells its word, the paths cover each letter once and touch no wall, and the
 * solver finds one way to fit the words, the stored one.
 */
export function validateWendPuzzle(puzzle: WendShape): PuzzleCheck {
  const problems: string[] = [];
  const { size, letters, words } = puzzle;
  if (letters.length !== size * size) problems.push("The board does not match its size.");
  if (letters.some((letter) => letter !== "" && !/^[A-Z]$/.test(letter))) problems.push("A cell holds something that is not a letter.");

  const covered = new Set<number>();
  for (const word of words) {
    if (!isPath(size, word.path)) problems.push(`${word.text} does not run along neighbouring cells.`);
    if (word.path.map((cell) => letters[cell]).join("") !== word.text) problems.push(`The path of ${word.text} does not spell it.`);
    for (const cell of word.path) {
      if (covered.has(cell)) problems.push(`Cell ${cell} belongs to two words.`);
      covered.add(cell);
    }
  }
  letters.forEach((letter, cell) => {
    if (letter !== "" && !covered.has(cell)) problems.push(`The letter at cell ${cell} belongs to no word.`);
  });
  if (new Set(words.map((word) => word.text)).size !== words.length) problems.push("A word is hidden twice.");
  for (let index = 1; index < words.length; index++) if (words[index].text.length < words[index - 1].text.length) problems.push("The words are not sorted by length.");

  try {
    const solved = solveWend(
      size,
      letters,
      words.map((word) => word.text),
      2,
      2_000_000,
    );
    if (solved.count !== 1) problems.push(solved.count === 0 ? "The solver cannot fit the words." : "The words fit in more than one way.");
    else if (solved.first?.some((path, index) => cellSetKey(path) !== cellSetKey(words[index].path))) problems.push("The solver's answer is not the stored one.");
  } catch (error) {
    if (!(error instanceof SolverBudgetExceeded)) throw error;
    problems.push("The solver ran out of budget.");
  }
  return { ok: problems.length === 0, problems };
}
