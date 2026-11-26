import { type Locale, isLocale } from "@/i18n/config";

/**
 * Reminders of a streak about to end, as rules without side effects. The
 * server and the tests share them.
 *
 * A reminder is a Web Push message. The browser gives each device an
 * endpoint, a URL at its vendor's push service, and two keys. The server
 * posts an encrypted message to that URL, and the push service delivers it to
 * the device, which shows a notification even when the site is closed.
 */

/** No reminder before this local hour, or after the hour below: it would wake someone up. */
export const REMINDER_FIRST_HOUR = 9;
export const REMINDER_LAST_HOUR = 21;
/** The local hour a reminder is sent at when the day's deadline allows it: early in the evening, with the night still ahead to play. */
export const REMINDER_EVENING_HOUR = 19;
/** A reminder leaves at least this long to play. */
export const REMINDER_MIN_HOURS_LEFT = 3;
/** Where the evening comes too late, or too early, the reminder goes when this many hours are left, and for every run after that. */
export const REMINDER_LAST_CALL_HOURS = 5;
/** The calendar of the daily puzzles. A day ends, and a streak with it, at midnight there. */
export const DAILY_TIME_ZONE = "America/Los_Angeles";

/**
 * The push services of the browsers that support Web Push. The server sends
 * requests to the endpoint a client gives it, so the endpoint has to be one of
 * these and nothing else: any other URL would turn the server into a way to
 * reach addresses it should not, with a body the caller partly controls.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, and every Chromium browser
  /^jmt17\.google\.com$/, // Chrome Beta, Dev and Canary, and Chromium builds without a brand
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows
  /^[a-z0-9-]+\.push\.apple\.com$/, // Safari, and every browser on iOS
];

export const ENDPOINT_MAX_LENGTH = 1024;

/**
 * The endpoint as the server will store and call it, or null for one it will
 * not send to: it has to be https, on the default port, at a known push
 * service. What comes back is the URL as the parser wrote it, not the text
 * that came in, so the address that was checked is the address that is used.
 */
export function normalizePushEndpoint(input: unknown): string | null {
  if (typeof input !== "string" || input.length > ENDPOINT_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return null;
  return PUSH_HOSTS.some((host) => host.test(url.hostname)) ? url.href : null;
}

/** True for an endpoint the server is willing to send to. */
export const isPushEndpoint = (input: unknown): boolean => normalizePushEndpoint(input) !== null;

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; locale: Locale; timezone: string };

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** True for the secret half of a subscription: 16 bytes or a few more, in base64url without padding. Fewer cannot encrypt a message. */
export function isAuthSecret(input: unknown): input is string {
  return typeof input === "string" && BASE64URL.test(input) && input.length >= 22 && input.length <= 40;
}

/** True for a time zone this runtime can compute a local hour in. */
export function isTimeZone(input: unknown): input is string {
  if (typeof input !== "string" || input.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input });
    return true;
  } catch {
    return false;
  }
}

/**
 * What a client sends to be reminded: the subscription its browser made, the
 * language to write to it in and the time zone its evening is in. Null when
 * any piece is not what it should be.
 */
export function parseSubscription(body: Record<string, unknown>): PushSubscriptionInput | null {
  const subscription = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null | undefined;
  if (typeof subscription !== "object" || subscription === null) return null;
  const keys = subscription.keys;
  const endpoint = normalizePushEndpoint(subscription.endpoint);
  if (endpoint === null || typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys;
  // A P-256 public key is 65 bytes, the first of them 0x04: 87 characters of base64url without padding, starting with "B".
  // Whether it is a point of the curve is the server's to check (`subscribe`): this file also runs in the browser.
  if (typeof p256dh !== "string" || !BASE64URL.test(p256dh) || p256dh.length !== 87 || !p256dh.startsWith("B")) return null;
  if (!isAuthSecret(auth)) return null;
  if (!isLocale(body.locale) || !isTimeZone(body.timezone)) return null;
  return { endpoint, p256dh, auth, locale: body.locale, timezone: body.timezone };
}

/** The hour of the day, 0 to 23, that `now` is in a time zone. */
export function localHour(timezone: string, now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now);
  return Number(hour) % 24;
}

/** Whole hours until the day of the daily puzzles ends, 1 to 24, counting the hour that is running. */
export function hoursLeftToday(now: Date): number {
  return 24 - localHour(DAILY_TIME_ZONE, now);
}

/** Seconds from `now` until the clock of a time zone next shows `hour`:00:00. Never 0: on the hour, it is a day away. */
function secondsUntilHour(timezone: string, hour: number, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(now);
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const passed = (read("hour") % 24) * 3600 + read("minute") * 60 + read("second");
  const day = 24 * 3600;
  return ((hour * 3600 - passed + day - 1) % day) + 1;
}

/** A push service keeps a reminder for a device that is off at most this long. */
const REMINDER_MAX_TTL_SECONDS = 4 * 60 * 60;

/**
 * How long a push service may hold a reminder for a device it cannot reach
 * right now. Never past the end of the day the reminder is about, when it
 * would announce a streak that is already over, and never into the night of
 * the device. At least a minute: zero would mean "only if connected this
 * instant".
 */
export function reminderTtlSeconds(timezone: string, now: Date): number {
  const untilDeadline = secondsUntilHour(DAILY_TIME_ZONE, 0, now);
  const untilNight = secondsUntilHour(timezone, REMINDER_LAST_HOUR + 1, now);
  return Math.max(60, Math.min(REMINDER_MAX_TTL_SECONDS, untilDeadline, untilNight));
}

/**
 * True when this is the hour to remind a device in that time zone.
 *
 * The day that counts ends at midnight Pacific, which is a different hour
 * everywhere: 05:00 in Sao Paulo, 08:00 in Lisbon, 17:00 in Tokyo. A fixed
 * local hour is right in the first two and wrong in the third, where 19:00 is
 * two hours into the next day. So the hour follows the deadline:
 *
 * - in the evening, from 19:00, when waiting for the next morning would leave
 *   less than three hours. That is the Americas, Europe and Africa;
 * - anywhere else at a civil hour, once five hours or fewer are left. That is
 *   early afternoon in Tokyo and mid-afternoon in Sydney.
 *
 * Both stay true for the runs that follow, so a run that failed is made up
 * for by the next. Every hour that passes this test is at least eight hours
 * into the Pacific day, so a device marked as reminded for that day cannot be
 * due twice in it.
 */
export function isReminderHour(timezone: string, now: Date): boolean {
  const hour = localHour(timezone, now);
  if (hour < REMINDER_FIRST_HOUR || hour > REMINDER_LAST_HOUR) return false;
  const left = hoursLeftToday(now);
  if (left <= REMINDER_LAST_CALL_HOURS) return true;
  const untilMorning = 24 - hour + REMINDER_FIRST_HOUR;
  return hour >= REMINDER_EVENING_HOUR && left - untilMorning < REMINDER_MIN_HOURS_LEFT;
}
