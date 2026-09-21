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
  generatorVersion: number;
};

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
};

export function dailyDifficulty(codec: SeedCodec, config: DailyConfig, date: DateKey): Difficulty {
  const options = config.schedule[dayOfWeek(date) as keyof WeeklySchedule];
  if (options.length === 1) return options[0];
  return createRng(`${codec.prefix}|schedule|v${config.generatorVersion}|${date}`).pick(options);
}

export function dailyNumber(config: DailyConfig, date: DateKey): number {
  return daysBetween(config.epoch, date) + 1;
}

/** The daily seed is an ordinary seed whose token is the Pacific date. */
export function getDailyInfo(codec: SeedCodec, config: DailyConfig, date: DateKey): DailyInfo {
  if (!isDateKey(date)) throw new RangeError(`Invalid daily date: ${date}`);
  const difficulty = dailyDifficulty(codec, config, date);
  const spec: PuzzleSpec = { token: date, version: config.generatorVersion, difficulty };
  return { date, number: dailyNumber(config, date), difficulty, spec, seed: codec.format(spec) };
}

/** Recognizes a daily seed and returns its date. Forged difficulty or size does not match. */
export function dailyDateFromSpec(codec: SeedCodec, config: DailyConfig, spec: PuzzleSpec): DateKey | null {
  if (!isDateKey(spec.token) || spec.size !== undefined) return null;
  return getDailyInfo(codec, config, spec.token).seed === codec.format(spec) ? spec.token : null;
}
