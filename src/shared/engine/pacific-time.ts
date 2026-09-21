/**
 * Calendar helpers pinned to America/Los_Angeles.
 *
 * The daily puzzle changes at midnight Pacific Time for every player, so the
 * browser's own timezone must never leak into these calculations. Dates are
 * passed around as "YYYY-MM-DD" strings, which sort and compare correctly.
 */

export const DAILY_TIME_ZONE = "America/Los_Angeles";

export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DAILY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type PacificParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pacificParts(instant: Date): PacificParts {
  const lookup: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(instant)) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour % 24,
    minute: lookup.minute,
    second: lookup.second,
  };
}

function toKey(year: number, month: number, day: number): DateKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Calendar date in Pacific Time for the given instant. */
export function pacificDateKey(instant: Date): DateKey {
  const { year, month, day } = pacificParts(instant);
  return toKey(year, month, day);
}

/** Days since 1970-01-01 for a calendar date. Pure calendar math, no timezone. */
export function dateKeyToDayNumber(key: DateKey): number {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match || !isDateKey(key)) throw new RangeError(`Invalid date key: ${key}`);
  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY,
  );
}

export function dayNumberToDateKey(dayNumber: number): DateKey {
  const date = new Date(dayNumber * MS_PER_DAY);
  return toKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(key: DateKey, days: number): DateKey {
  return dayNumberToDateKey(dateKeyToDayNumber(key) + days);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return dateKeyToDayNumber(to) - dateKeyToDayNumber(from);
}

/** 0 = Sunday ... 6 = Saturday, for the calendar date itself. */
export function dayOfWeek(key: DateKey): number {
  return new Date(dateKeyToDayNumber(key) * MS_PER_DAY).getUTCDay();
}

/**
 * Milliseconds from `instant` until the next Pacific midnight.
 * The estimate from wall-clock parts is off by an hour on DST change days,
 * so it is corrected against the real date boundary.
 */
export function msUntilPacificMidnight(instant: Date): number {
  const today = pacificDateKey(instant);
  const { hour, minute, second } = pacificParts(instant);
  const elapsedMs =
    ((hour * 60 + minute) * 60 + second) * 1000 + (instant.getTime() % 1000);
  let target = instant.getTime() + (MS_PER_DAY - elapsedMs);

  while (pacificDateKey(new Date(target)) === today) target += MS_PER_HOUR;
  while (pacificDateKey(new Date(target - MS_PER_HOUR)) !== today) {
    target -= MS_PER_HOUR;
  }
  return Math.max(0, target - instant.getTime());
}
