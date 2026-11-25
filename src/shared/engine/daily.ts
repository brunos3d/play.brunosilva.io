import type { Difficulty } from "./difficulty";
import { type DateKey, dayOfWeek, daysBetween, isDateKey } from "./pacific-time";
import { createRng } from "./prng";
import type { PuzzleSpec, SeedCodec } from "./seed-codec";

/** Tiers a weekday can use. With two entries, the date decides which one runs. */
export type WeeklySchedule = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, readonly Difficulty[]>;

export type DailyConfig = {
  /** Pacific date of puzzle #1. */
  epoch: DateKey;
  /** Indexed by day of week, 0 = Sunday. */
  schedule: WeeklySchedule;
  /** Generator of the first daily puzzles. It also keys the weekday draw, so past difficulties never change. */
  generatorVersion: number;
  /**
   * Later generators, each from a date on. A daily puzzle keeps the generator
   * that was current on its date, so going back to an old date shows the board
   * that was played that day.
   */
  upgrades?: readonly { from: DateKey; version: number }[];
};

export function dailyGeneratorVersion(config: DailyConfig, date: DateKey): number {
  let version = config.generatorVersion;
  for (const upgrade of config.upgrades ?? []) if (date >= upgrade.from) version = Math.max(version, upgrade.version);
  return version;
}

/** Easier early in the week, hardest on Sunday. Shared by every game unless one overrides it. */
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  1: ["easy"],
  2: ["easy", "medium"],
  3: ["medium"],
  4: ["medium", "hard"],
  5: ["hard"],
  6: ["hard"],
  0: ["expert"],
};

export type DailyInfo = {
  date: DateKey;
  /** 1 on the epoch date. Zero or negative before it. */
  number: number;
  difficulty: Difficulty;
  spec: PuzzleSpec;
  seed: string;
  /**
   * Set when the game has one daily puzzle per language and this is not the
   * legacy one: the language code. Results of a variant are stored apart, so
   * the day's puzzle in one language does not close the day in another.
   */
  variant?: string;
};

export function dailyDifficulty(codec: SeedCodec, config: DailyConfig, date: DateKey): Difficulty {
  const options = config.schedule[dayOfWeek(date) as keyof WeeklySchedule];
  if (options.length === 1) return options[0];
  return createRng(`${codec.prefix}|schedule|v${config.generatorVersion}|${date}`).pick(options);
}

export function dailyNumber(config: DailyConfig, date: DateKey): number {
  return daysBetween(config.epoch, date) + 1;
}

/**
 * The daily seed is an ordinary seed whose token is the Pacific date. A game
 * with languages has one daily puzzle per language: same date, same number,
 * same difficulty, different words.
 */
export function getDailyInfo(codec: SeedCodec, config: DailyConfig, date: DateKey, lang?: string | null): DailyInfo {
  if (!isDateKey(date)) throw new RangeError(`Invalid daily date: ${date}`);
  const difficulty = dailyDifficulty(codec, config, date);
  const spec = codec.withLanguage({ token: date, version: dailyGeneratorVersion(config, date), difficulty }, lang);
  return { date, number: dailyNumber(config, date), difficulty, spec, seed: codec.format(spec), ...(spec.lang ? { variant: spec.lang } : {}) };
}

/** Recognizes a daily seed and returns its date. Forged difficulty or size does not match. */
export function dailyDateFromSpec(codec: SeedCodec, config: DailyConfig, spec: PuzzleSpec): DateKey | null {
  if (!isDateKey(spec.token) || spec.size !== undefined) return null;
  return getDailyInfo(codec, config, spec.token, spec.lang).seed === codec.format(spec) ? spec.token : null;
}
