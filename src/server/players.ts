import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cleanAvatarSeed, cleanNickname, cleanPlayerName, nicknameFromName, randomAvatarSeed, randomPlayerName } from "@/shared/online/names";
import type { Me } from "@/shared/online/types";
import { query, t } from "./db";
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
 * device back the player it had before.
 *
 * There is no password and no email anywhere. See src/server/accounts.ts for
 * the passkeys themselves.
 */
const DEVICE_COOKIE = "play_player";
const SESSION_COOKIE = "play_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

/** The account this device is signed in to, or null. */
async function sessionPlayer(): Promise<Me | null> {
  const cookie = parseCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!cookie) return null;
  const [row] = await query<PlayerRow>(`select ${PLAYER_COLUMNS}, s.secret_hash from ${t("sessions")} s join ${t("players")} p on p.id = s.player_id where s.id = $1`, [cookie.id]);
  return row && matches(cookie.secret, row.secret_hash) ? toMe(row) : null;
}

/** A player by id, for code that has just proven who is asking (a passkey that checked out). */
export async function playerById(id: string): Promise<Me | null> {
  const [row] = await query<PlayerRow>(`select ${PLAYER_COLUMNS}, p.secret_hash from ${t("players")} p where p.id = $1`, [id]);
  return row ? toMe(row) : null;
}

/** The player the request acts as: the account it is signed in to, or else the device's own player. Null when it has neither. */
export async function currentPlayer(): Promise<Me | null> {
  return (await sessionPlayer()) ?? (await devicePlayer());
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
  const name = cleanPlayerName(hint.name) ?? randomPlayerName(typeof hint.locale === "string" ? hint.locale : "en");
  const avatar = cleanAvatarSeed(hint.avatar) ?? randomAvatarSeed();
  const wanted = nicknameFromName(name);
  const [created] = await query<{ nickname: string }>(
    `insert into ${t("players")} (id, secret_hash, name, avatar, nickname)
     select $1, $2, $3, $4, case when exists (select 1 from ${t("players")} where lower(nickname) = $5) then $6 else $5 end
     returning nickname`,
    [id, hashSecret(secret), name, avatar, wanted, `${wanted}_${randomBytes(2).toString("hex")}`],
  );
  (await cookies()).set(DEVICE_COOKIE, `${id}.${secret}`, cookieOptions());
  return { id, name, nickname: created.nickname, avatar, streak: 0, bestStreak: 0, account: false };
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

/** Signs this device in to an account: a new session, and its cookie. */
export async function openSession(playerId: string): Promise<void> {
  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  await query(`insert into ${t("sessions")} (id, player_id, secret_hash) values ($1, $2, $3)`, [id, playerId, hashSecret(secret)]);
  (await cookies()).set(SESSION_COOKIE, `${id}.${secret}`, cookieOptions());
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
  if (session) await query(`delete from ${t("sessions")} where id = $1`, [session.id]);
  jar.delete(SESSION_COOKIE);
  const device = await devicePlayer();
  if (device?.account) jar.delete(DEVICE_COOKIE);
}

/** Drops the session cookie, for an account that no longer exists. */
export async function forgetSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Drops the device's own cookie and keeps the session: that player was merged into the account, or deleted. */
export async function forgetDevicePlayer(): Promise<void> {
  (await cookies()).delete(DEVICE_COOKIE);
}
