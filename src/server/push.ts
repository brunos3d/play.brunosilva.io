import "server-only";
import { createECDH } from "node:crypto";
import { createTranslator } from "next-intl";
import webpush from "web-push";
import { type Locale, isLocale, localizePath } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { type PushSubscriptionInput, isAuthSecret, isReminderHour, normalizePushEndpoint, reminderTtlSeconds } from "@/shared/online/push";
import type { Me } from "@/shared/online/types";
import { SITE_ORIGIN } from "@/shared/platform/site";
import { query, t, transaction } from "./db";
import { ApiFailure } from "./http";

/**
 * Reminders of a streak about to end. A device subscribes from the settings,
 * and once an hour a scheduled request (vercel.json) sends a notification to
 * the devices of players whose streak ends today unless they play, at an hour
 * that still leaves them time to (see `isReminderHour`).
 *
 * The server signs each message with a VAPID key pair, which is how a push
 * service knows who is sending. The public half goes to the browser when it
 * subscribes. Without the keys in the environment the feature is off: the
 * client is told so and never offers it.
 */
const PACIFIC_TODAY = "(now() at time zone 'America/Los_Angeles')::date";
/** A device whose push service refused this many reminders in a row is dropped. */
const MAX_FAILURES = 5;
/** Reminders one run takes on. An hour later the next run takes what is left. */
const BATCH = 2_000;
/** Messages on their way at the same time. */
const CONCURRENCY = 12;
/** A run stops taking on devices after this long, well inside what the route is allowed (see the cron route). */
const RUN_BUDGET_MS = 90_000;
/** Devices looked at in one run: everyone whose streak ends today and who has not been reminded, in any time zone. */
const MAX_CANDIDATES = 20_000;
/** A push service that does not answer in this long is given up on, so one slow service cannot hold the run. */
const SEND_TIMEOUT_MS = 8_000;
const MAX_SUBSCRIPTIONS_PER_PLAYER = 8;

type Keys = { publicKey: string; privateKey: string; subject: string };

function vapid(): Keys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  // Who a push service may contact about these messages. A URL of the site, so no address of a person is in it.
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || SITE_ORIGIN };
}

/** The key a browser needs to subscribe, or null when reminders are not set up on this deployment. */
export const pushPublicKey = (): string | null => vapid()?.publicKey ?? null;

/**
 * Stores a device's subscription for a player, or updates it: the same device
 * asks again when its language changes, and when another player signs in on
 * it the subscription follows that player.
 *
 * A subscription that exists is only changed by a request that presents its
 * keys. The device has them, and someone who merely learned the endpoint does
 * not, so a subscription cannot be taken over or pointed at another player.
 * Such a request is refused out loud, so a device never believes it is
 * subscribed when it is not.
 *
 * A player has a limit of devices. One more pushes out the oldest, which is
 * most likely a browser that no longer exists.
 */
export async function subscribe(player: Me, input: PushSubscriptionInput): Promise<void> {
  if (!isCurvePoint(input.p256dh)) throw new ApiFailure(400, "invalid-subscription");
  const table = t("push_subscriptions");
  const results = await transaction([
    {
      // Only when the row below is going to be written: a request that is refused must not cost the player a device.
      text: `delete from ${table} where player_id = $1
               and not exists (select 1 from ${table} where endpoint = $2 and (p256dh <> $3 or auth <> $4))
               and endpoint in (select endpoint from ${table} where player_id = $1 and endpoint <> $2 order by created_at desc, endpoint offset ${MAX_SUBSCRIPTIONS_PER_PLAYER - 1})`,
      params: [player.id, input.endpoint, input.p256dh, input.auth],
    },
    {
      // A row made today for a player already reminded today starts as reminded: signing out and in again deletes the
      // row and makes a new one, and that must not earn a second reminder.
      text: `insert into ${table} (endpoint, player_id, p256dh, auth, locale, timezone, last_sent)
             select $1, $2, $3, $4, $5, $6, (select case when p.reminded_on = ${PACIFIC_TODAY} then p.reminded_on end from ${t("players")} p where p.id = $2)
             on conflict (endpoint) do update set player_id = excluded.player_id, locale = excluded.locale, timezone = excluded.timezone, failures = 0,
               last_sent = greatest(${table}.last_sent, excluded.last_sent)
               where ${table}.p256dh = excluded.p256dh and ${table}.auth = excluded.auth
             returning endpoint`,
      params: [input.endpoint, player.id, input.p256dh, input.auth, input.locale, input.timezone],
    },
  ]);
  if (results[1].length === 0) throw new ApiFailure(409, "subscription-refused");
}

/**
 * True when a key is a point of the P-256 curve. A message cannot be
 * encrypted for anything else, so a subscription with such a key could never
 * be reminded, and would fail on this side every hour without the push
 * service ever hearing of it.
 */
function isCurvePoint(p256dh: string): boolean {
  try {
    const ours = createECDH("prime256v1");
    ours.generateKeys();
    ours.computeSecret(Buffer.from(p256dh, "base64url"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Forgets a subscription, for whoever presents its endpoint and its secret.
 * A device that has signed out has no player to speak for it, and still has
 * both. The endpoint alone is not enough.
 */
export async function unsubscribe(endpoint: unknown, auth: unknown): Promise<void> {
  const normalized = normalizePushEndpoint(endpoint);
  if (normalized === null || !isAuthSecret(auth)) return;
  await query(`delete from ${t("push_subscriptions")} where endpoint = $1 and auth = $2`, [normalized, auth]);
}

/** True when the endpoint is subscribed for this player. */
export async function isSubscribed(player: Me, endpoint: unknown): Promise<boolean> {
  const normalized = normalizePushEndpoint(endpoint);
  if (normalized === null) return false;
  const [row] = await query(`select 1 as found from ${t("push_subscriptions")} where endpoint = $1 and player_id = $2`, [normalized, player.id]);
  return Boolean(row);
}

type Due = { endpoint: string; player: string; p256dh: string; auth: string; locale: string; timezone: string; streak: number };

type Translate = (key: string, values?: Record<string, number>) => string;
const translators = new Map<Locale, Promise<Translate>>();

/** The reminder's texts in one language, loaded once. */
function translator(locale: Locale): Promise<Translate> {
  let ready = translators.get(locale);
  if (!ready) {
    ready = loadMessages(locale).then((messages) => {
      const translate = createTranslator({ locale, messages, namespace: "common.reminder" });
      // The keys are checked by the tests that compare the two languages, not by the compiler: the messages are loaded at run time.
      return (key, values) => translate(key as never, values as never) as string;
    });
    translators.set(locale, ready);
  }
  return ready;
}

/** The text of a reminder, in the language its device asked for. */
async function reminderText(locale: Locale, streak: number): Promise<{ title: string; body: string }> {
  const text = await translator(locale);
  return { title: text("title", { count: streak }), body: text("body") };
}

export type ReminderRun = { due: number; sent: number; gone: number; failed: number; waiting: number; dry: boolean };

/** True for a failure worth another try an hour later: no answer, "slow down", or a fault on the service's side. */
const isPassing = (status: number | undefined): boolean => status === undefined || status === 429 || status >= 500;

/**
 * Sends the reminders that are due now. A player is due when their streak
 * ends today: the last day they scored is yesterday on the Pacific calendar,
 * the calendar of the daily puzzles. A device is due when it is the hour for
 * it where it is (`isReminderHour`) and it has not been reminded today.
 *
 * A device is marked as reminded before the message goes out, so two runs that
 * overlap cannot both send to it. When the push service could not be reached,
 * the mark is taken back and the next run tries again. The player is marked
 * too (`reminded_on`), once the message is with the push service, for the
 * subscriptions made later that day (see `subscribe`). A push service that
 * says the subscription is gone (404 or 410) gets it deleted, and one that
 * keeps refusing a device gets it dropped after a few days.
 *
 * `now` only decides the hour. The day is the database's, in every statement.
 */
export async function sendReminders(now: Date = new Date()): Promise<ReminderRun> {
  const keys = vapid();
  const dry = process.env.PUSH_DRY_RUN === "1";
  const run: ReminderRun = { due: 0, sent: 0, gone: 0, failed: 0, waiting: 0, dry };
  if (!keys && !dry) return run;
  // A pair that is not a key pair fails here, before any device is marked, and the run is reported as an error.
  if (keys && !dry) webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  const table = t("push_subscriptions");
  // Those reminded longest ago come first, so a run that cannot reach everyone does not leave out the same devices each day.
  const candidates = await query<Due>(
    `select s.endpoint, s.player_id as player, s.p256dh, s.auth, s.locale, s.timezone, p.streak_current as streak
     from ${table} s join ${t("players")} p on p.id = s.player_id
     where p.streak_current >= 1 and p.streak_date = ${PACIFIC_TODAY} - 1 and (s.last_sent is null or s.last_sent < ${PACIFIC_TODAY})
     order by s.last_sent nulls first, s.created_at limit ${MAX_CANDIDATES}`,
  );
  // The hour is the device's own, which only this side can work out. The cut to one batch comes after it, so devices
  // in other time zones never crowd out the ones whose hour it is.
  const due = candidates.filter((row) => isReminderHour(row.timezone, now)).slice(0, BATCH);
  run.due = due.length;

  /** A statement whose failure must not stop anything: the device's turn is over either way, and the next run sees the row as it is. */
  const quietly = (text: string, params: unknown[]): Promise<unknown> => query(text, params).catch((error: unknown) => console.error("push reminder bookkeeping failed", error));
  const release = (row: Due): Promise<unknown> => quietly(`update ${table} set last_sent = ${PACIFIC_TODAY} - 1 where endpoint = $1`, [row.endpoint]);
  const reminded = (row: Due): Promise<unknown> => quietly(`update ${t("players")} set reminded_on = ${PACIFIC_TODAY} where id = $1`, [row.player]);

  /** One device, start to finish. Never rejects: what goes wrong with one device stays with it. */
  const remind = async (row: Due): Promise<void> => {
    let claimed = false;
    try {
      // Claimed first: only the run that moves the date sends.
      const rows = await query(`update ${table} set last_sent = ${PACIFIC_TODAY} where endpoint = $1 and (last_sent is null or last_sent < ${PACIFIC_TODAY}) returning endpoint`, [row.endpoint]);
      if (rows.length === 0) return;
      claimed = true;
      if (dry || !keys) {
        run.sent++;
        await reminded(row);
        return;
      }
      const locale: Locale = isLocale(row.locale) ? row.locale : "en";
      const text = await reminderText(locale, Number(row.streak));
      const payload = JSON.stringify({ ...text, url: localizePath(locale, "/"), tag: "streak" });
      // The message is only worth delivering today, and before the device's night: one that is off until then should not get it later.
      const options = { vapidDetails: keys, TTL: reminderTtlSeconds(row.timezone, now), urgency: "normal" as const, topic: "streak", timeout: SEND_TIMEOUT_MS };
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, options);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (claimed && (status === 404 || status === 410)) {
        run.gone++;
        await quietly(`delete from ${table} where endpoint = $1`, [row.endpoint]);
        return;
      }
      run.failed++;
      // The host says which push service. The rest of the address is the device's, and stays out of the logs.
      console.error("push reminder failed", new URL(row.endpoint).host, status ?? (error as Error).message);
      if (!claimed) return;
      if (isPassing(status)) {
        // Nothing wrong with the device. The mark comes off, and a later run today sends it.
        await release(row);
      } else {
        await quietly(`delete from ${table} where endpoint = $1 and failures + 1 >= ${MAX_FAILURES}`, [row.endpoint]);
        await quietly(`update ${table} set failures = failures + 1 where endpoint = $1`, [row.endpoint]);
      }
      return;
    }
    // Delivered to the push service. What follows is bookkeeping, and its failure is not the message's.
    run.sent++;
    await reminded(row);
    await quietly(`update ${table} set failures = 0 where endpoint = $1 and failures > 0`, [row.endpoint]);
  };

  const started = Date.now();
  for (let index = 0; index < due.length; index += CONCURRENCY) {
    // Out of time: what is left waits for the next run, and this one still answers with its counts.
    if (Date.now() - started > RUN_BUDGET_MS) {
      run.waiting = due.length - index;
      break;
    }
    await Promise.allSettled(due.slice(index, index + CONCURRENCY).map(remind));
  }
  return run;
}
