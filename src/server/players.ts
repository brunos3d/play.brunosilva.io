import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isLocale } from "@/i18n/config";
import { cleanAvatarSeed, cleanNickname, cleanPlayerName, nicknameFromName, randomAvatarSeed, randomPlayerName } from "@/shared/online/names";
import type { Me } from "@/shared/online/types";
import { query, t, transaction } from "./db";
import { ApiFailure } from "./http";

/**
 * Who a request comes from. There are two ways to be a player.
 *
 * A device player needs no account. The first time a device needs an identity
 * (it joins a room, or finishes a daily puzzle), the server creates a player
 * and sets the `play_player` cookie with the player's id and a random secret.
 * The database keeps only a hash of the secret, so reading the table gives
 * nobody a way to act as a player. The cookie is httpOnly: scripts on the page
 * cannot read it, and the only way to copy it is from the device itself.
 *
 * A player with a passkey is an account, and can be reached from any device.
 * Signing in with the passkey creates a session: a row in `sessions` and the
 * `play_session` cookie, built the same way as the device cookie. A session
 * wins over the device cookie, which stays where it is: signing out gives the
 * device back the player it had before. Making the account gives the device
 * it is made on a session too, and its secret is retired on the next request
 * that shows the session arrived (see `currentPlayer`), so every device of an
 * account can be signed out and none has a key that cannot be taken back.
 *
 * There is no password and no email anywhere. See src/server/accounts.ts for
 * the passkeys themselves.
 */
const DEVICE_COOKIE = "play_player";
const SESSION_COOKIE = "play_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A session nobody has used for this long is over. Using it moves the date, at most once a day. */
const SESSION_IDLE = "180 days";
/** Devices signed in to one account. Past that, the one unused the longest is signed out. */
const MAX_SESSIONS = 20;
/** The device secret of a player that can no longer be reached with one. No secret hashes to it. */
const NO_SECRET = "";

type PlayerRow = {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  secret_hash: string;
  streak_current: number;
  streak_best: number;
  streak_alive: boolean;
  passkeys: number;
};

const hashSecret = (secret: string): string => createHash("sha256").update(secret).digest("hex");

const toMe = (row: PlayerRow): Me => ({ id: row.id, name: row.name, nickname: row.nickname, avatar: row.avatar, streak: row.streak_alive ? row.streak_current : 0, bestStreak: row.streak_best, account: Number(row.passkeys) > 0 });

/** A streak is alive while its last day is today or yesterday on the Pacific calendar, the calendar the daily puzzles follow. */
const PLAYER_COLUMNS = `p.id, p.name, p.nickname, p.avatar, p.streak_current, p.streak_best,
  coalesce(p.streak_date >= (now() at time zone 'America/Los_Angeles')::date - 1, false) as streak_alive,
  (select count(*) from ${t("passkeys")} k where k.player_id = p.id)::int as passkeys`;

/** Splits "<uuid>.<secret>". Null for anything else, without a trip to the database. */
function parseCookie(value: string | undefined): { id: string; secret: string } | null {
  if (!value) return null;
  const separator = value.indexOf(".");
  const id = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  return separator < 0 || !UUID.test(id) || secret.length < 20 ? null : { id, secret };
}

function matches(secret: string, hash: string): boolean {
  const expected = Buffer.from(hash, "hex");
  const given = Buffer.from(hashSecret(secret), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const cookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: COOKIE_MAX_AGE });

/** The player of the device's own cookie, whoever is signed in on top of it. Null when the device never had one, or the cookie does not check out. */
export async function devicePlayer(): Promise<Me | null> {
  const cookie = parseCookie((await cookies()).get(DEVICE_COOKIE)?.value);
  if (!cookie) return null;
  const [row] = await query<PlayerRow>(`select ${PLAYER_COLUMNS}, p.secret_hash from ${t("players")} p where p.id = $1`, [cookie.id]);
  return row && matches(cookie.secret, row.secret_hash) ? toMe(row) : null;
}

/** The session of this request, and the account it is signed in to. Null without a session that works. */
async function currentSession(): Promise<{ id: string; player: Me } | null> {
  const cookie = parseCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!cookie) return null;
  const [row] = await query<PlayerRow & { stale: boolean }>(
    `select ${PLAYER_COLUMNS}, s.secret_hash, s.last_seen_at < now() - interval '1 day' as stale
     from ${t("sessions")} s join ${t("players")} p on p.id = s.player_id
     where s.id = $1 and s.last_seen_at > now() - interval '${SESSION_IDLE}'`,
    [cookie.id],
  );
  if (!row || !matches(cookie.secret, row.secret_hash)) return null;
  // The session is in use: its idle clock starts again. Once a day is enough to tell a live one from a forgotten one.
  if (row.stale) await query(`update ${t("sessions")} set last_seen_at = now() where id = $1`, [cookie.id]);
  return { id: cookie.id, player: toMe(row) };
}

/** The account this device is signed in to, or null. */
const sessionPlayer = async (): Promise<Me | null> => (await currentSession())?.player ?? null;

/** True when the request is signed in to this player with a session, as opposed to being the device the player was made on. */
export async function isSignedInAs(playerId: string): Promise<boolean> {
  return (await sessionPlayer())?.id === playerId;
}

/** A player by id, for code that has just proven who is asking (a passkey that checked out). */
export async function playerById(id: string): Promise<Me | null> {
  const [row] = await query<PlayerRow>(`select ${PLAYER_COLUMNS}, p.secret_hash from ${t("players")} p where p.id = $1`, [id]);
  return row ? toMe(row) : null;
}

/** The player the request acts as: the account it is signed in to, or else the device's own player. Null when it has neither. */
export async function currentPlayer(): Promise<Me | null> {
  const signedIn = await sessionPlayer();
  if (!signedIn) return devicePlayer();
  // The device an account was made on still carries the cookie it reached the player with. A request that shows both
  // proves the browser holds the session, so the device secret has done its job and is retired. Not earlier: had the
  // answer that set the session cookie been lost, the device would have been left with no way in.
  const device = parseCookie((await cookies()).get(DEVICE_COOKIE)?.value);
  if (device?.id === signedIn.id) await retireDeviceSecret(signedIn.id);
  return signedIn;
}

/** The current player, or a 401 for a request that should have had one. */
export async function requirePlayer(): Promise<Me> {
  const player = await currentPlayer();
  if (!player) throw new ApiFailure(401, "no-player");
  return player;
}

/**
 * The current player, created on the spot when the device has none yet. `hint`
 * is what the client suggests for a new player: a name in the page's language
 * and an avatar seed. Both are cleaned, and replaced when they do not pass.
 * The nickname is made from the name, with a random tail when it is taken.
 */
export async function ensurePlayer(hint: { name?: unknown; avatar?: unknown; locale?: unknown } = {}): Promise<Me> {
  const existing = await currentPlayer();
  if (existing) return existing;

  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const name = cleanPlayerName(hint.name) ?? randomPlayerName(isLocale(hint.locale) ? hint.locale : "en");
  const avatar = cleanAvatarSeed(hint.avatar) ?? randomAvatarSeed();
  const wanted = nicknameFromName(name);
  // The plain nickname, or one with a random tail when it is taken. Two requests can pick the same tail at the same
  // moment: the unique index refuses the second, which then tries again with a longer one.
  let nickname: string | null = null;
  for (let attempt = 0; attempt < 5 && nickname === null; attempt++) {
    const tail = randomBytes(2 + attempt).toString("hex");
    const [created] = await query<{ nickname: string }>(
      `insert into ${t("players")} (id, secret_hash, name, avatar, nickname)
       select $1, $2, $3, $4, case when exists (select 1 from ${t("players")} where lower(nickname) = $5) then $6 else $5 end
       returning nickname`,
      [id, hashSecret(secret), name, avatar, wanted, `${wanted.slice(0, 19 - tail.length)}_${tail}`],
    ).catch((error: unknown) => {
      if ((error as { code?: string }).code === "23505") return [];
      throw error;
    });
    nickname = created?.nickname ?? null;
  }
  if (nickname === null) throw new ApiFailure(503, "try-again");
  (await cookies()).set(DEVICE_COOKIE, `${id}.${secret}`, cookieOptions());
  return { id, name, nickname, avatar, streak: 0, bestStreak: 0, account: false };
}

/**
 * Changes the name, the nickname, the avatar, or any of them. A value that
 * does not pass the cleaning is refused, not silently replaced, and so is a
 * nickname that another player has.
 */
export async function updatePlayer(player: Me, patch: { name?: unknown; nickname?: unknown; avatar?: unknown }): Promise<Me> {
  const name = patch.name === undefined ? player.name : cleanPlayerName(patch.name);
  const avatar = patch.avatar === undefined ? player.avatar : cleanAvatarSeed(patch.avatar);
  const nickname = patch.nickname === undefined ? player.nickname : cleanNickname(patch.nickname);
  if (!name || !avatar) throw new ApiFailure(400, "invalid-profile");
  if (!nickname) throw new ApiFailure(400, "invalid-nickname");
  // One statement decides: the row changes only while nobody else holds the nickname, so two players asking at once cannot both get it.
  const [saved] = await query(
    `update ${t("players")} set name = $2, avatar = $3, nickname = $4, last_seen_at = now()
     where id = $1 and not exists (select 1 from ${t("players")} other where lower(other.nickname) = $4 and other.id <> $1)
     returning id`,
    [player.id, name, avatar, nickname],
  ).catch((error: unknown) => {
    // The unique index is the last word when two requests pass the check together.
    if ((error as { code?: string }).code === "23505") return [];
    throw error;
  });
  if (!saved) throw new ApiFailure(409, "nickname-taken");
  return { ...player, name, avatar, nickname };
}

/**
 * Signs this device in to an account: a new session, and its cookie. Each new
 * one sweeps away the sessions nobody uses any more, and the oldest of an
 * account that has more devices signed in than anyone has devices.
 */
export async function openSession(playerId: string): Promise<string> {
  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  await transaction([
    { text: `delete from ${t("sessions")} where last_seen_at < now() - interval '${SESSION_IDLE}'` },
    { text: `insert into ${t("sessions")} (id, player_id, secret_hash) values ($1, $2, $3)`, params: [id, playerId, hashSecret(secret)] },
    {
      text: `delete from ${t("sessions")} where player_id = $1 and id in (select id from ${t("sessions")} where player_id = $1 order by last_seen_at desc, created_at desc offset ${MAX_SESSIONS})`,
      params: [playerId],
    },
  ]);
  (await cookies()).set(SESSION_COOKIE, `${id}.${secret}`, cookieOptions());
  return id;
}

/**
 * Makes the device secret of a player stop working, and drops the cookie
 * that holds it. An account is reached through sessions, which can be ended
 * one by one or all at once. The secret of the device it was made on is the
 * one way in that could not be, so it is retired once that device holds a
 * session, and again whenever the device signs out.
 */
export async function retireDeviceSecret(playerId: string): Promise<void> {
  await query(`update ${t("players")} set secret_hash = $2 where id = $1`, [playerId, NO_SECRET]);
  const jar = await cookies();
  if (parseCookie(jar.get(DEVICE_COOKIE)?.value)?.id === playerId) jar.delete(DEVICE_COOKIE);
}

/**
 * Signs this device out. The session ends, and the device goes back to the
 * player it had before, if it had one. A device cookie that belongs to an
 * account goes too: that player is one passkey away, and leaving the cookie
 * would make "sign out" a lie on the device the account was made on.
 */
export async function closeSession(): Promise<void> {
  const jar = await cookies();
  const session = parseCookie(jar.get(SESSION_COOKIE)?.value);
  // Only the holder of the secret ends a session: an id alone, which is not a secret, ends nothing.
  if (session) await query(`delete from ${t("sessions")} where id = $1 and secret_hash = $2`, [session.id, hashSecret(session.secret)]);
  jar.delete(SESSION_COOKIE);
  const device = await devicePlayer();
  // An account made before device secrets were retired still has one that works. Signing out is where it stops.
  if (device?.account) await retireDeviceSecret(device.id);
}

/**
 * Signs the account out on every other device: every other session ends, the
 * secret of the device it was made on stops working, and no device is
 * reminded for the account any more. For a phone that was lost: the way back
 * in on any other device is a passkey.
 *
 * The session of the device asking is never touched, so the one button meant
 * to protect the account cannot lock its owner out, whatever fails halfway. A
 * device that was still reaching the account with its device secret is given
 * a session first, and loses nothing if that is as far as the request gets.
 */
export async function closeEverySession(player: Me): Promise<void> {
  const own = await currentSession();
  const keep = own?.player.id === player.id ? own.id : await openSession(player.id);
  await transaction([
    { text: `delete from ${t("sessions")} where player_id = $1 and id <> $2`, params: [player.id, keep] },
    { text: `delete from ${t("push_subscriptions")} where player_id = $1`, params: [player.id] },
    { text: `update ${t("players")} set secret_hash = $2 where id = $1`, params: [player.id, NO_SECRET] },
  ]);
  const jar = await cookies();
  if (parseCookie(jar.get(DEVICE_COOKIE)?.value)?.id === player.id) jar.delete(DEVICE_COOKIE);
}

/** Deletes the sessions nobody has used for as long as a session lasts. They had stopped working already. Run by the hourly job. */
export async function sweepSessions(): Promise<void> {
  await query(`delete from ${t("sessions")} where last_seen_at < now() - interval '${SESSION_IDLE}'`);
}

/** Drops the session cookie, for an account that no longer exists. */
export async function forgetSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Drops the device's own cookie and keeps the session: that player was merged into the account, or deleted. */
export async function forgetDevicePlayer(): Promise<void> {
  (await cookies()).delete(DEVICE_COOKIE);
}
