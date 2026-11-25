import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cleanAvatarSeed, cleanPlayerName, randomAvatarSeed, randomPlayerName } from "@/shared/online/names";
import type { Me } from "@/shared/online/types";
import { query, t } from "./db";
import { ApiFailure } from "./http";

/**
 * Players without accounts. The first time a device needs an identity (it
 * joins a room, or finishes a daily puzzle), the server creates a player and
 * sets a cookie with the player's id and a random secret. The database keeps
 * only a hash of the secret, so reading the table gives nobody a way to act as
 * a player. The cookie is httpOnly: scripts on the page cannot read it, and
 * the only way to copy it is from the device itself.
 *
 * There is no password and no email. Clearing the browser's data ends the
 * identity, and the player starts over as a new one.
 */
const COOKIE = "play_player";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type PlayerRow = { id: string; name: string; avatar: string; secret_hash: string; streak_current: number; streak_best: number; streak_date: string | null; streak_alive: boolean };

const hashSecret = (secret: string): string => createHash("sha256").update(secret).digest("hex");

const toMe = (row: PlayerRow): Me => ({ id: row.id, name: row.name, avatar: row.avatar, streak: row.streak_alive ? row.streak_current : 0, bestStreak: row.streak_best });

/** A streak is alive while its last day is today or yesterday on the Pacific calendar, the calendar the daily puzzles follow. */
const SELECT_PLAYER = `select id, name, avatar, secret_hash, streak_current, streak_best, streak_date::text as streak_date,
  coalesce(streak_date >= (now() at time zone 'America/Los_Angeles')::date - 1, false) as streak_alive
  from ${t("players")} where id = $1`;

/** The player the request's cookie belongs to, or null: no cookie, a malformed one, or a secret that does not match. */
export async function currentPlayer(): Promise<Me | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const separator = value.indexOf(".");
  const id = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  if (separator < 0 || !UUID.test(id) || secret.length < 20) return null;

  const [row] = await query<PlayerRow>(SELECT_PLAYER, [id]);
  if (!row) return null;
  const expected = Buffer.from(row.secret_hash, "hex");
  const given = Buffer.from(hashSecret(secret), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return toMe(row);
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
 */
export async function ensurePlayer(hint: { name?: unknown; avatar?: unknown; locale?: unknown } = {}): Promise<Me> {
  const existing = await currentPlayer();
  if (existing) return existing;

  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const name = cleanPlayerName(hint.name) ?? randomPlayerName(typeof hint.locale === "string" ? hint.locale : "en");
  const avatar = cleanAvatarSeed(hint.avatar) ?? randomAvatarSeed();
  await query(`insert into ${t("players")} (id, secret_hash, name, avatar) values ($1, $2, $3, $4)`, [id, hashSecret(secret), name, avatar]);
  (await cookies()).set(COOKIE, `${id}.${secret}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: COOKIE_MAX_AGE });
  return { id, name, avatar, streak: 0, bestStreak: 0 };
}

/** Changes the name, the avatar, or both. A value that does not pass the cleaning is refused, not silently replaced. */
export async function updatePlayer(player: Me, patch: { name?: unknown; avatar?: unknown }): Promise<Me> {
  const name = patch.name === undefined ? player.name : cleanPlayerName(patch.name);
  const avatar = patch.avatar === undefined ? player.avatar : cleanAvatarSeed(patch.avatar);
  if (!name || !avatar) throw new ApiFailure(400, "invalid-profile");
  await query(`update ${t("players")} set name = $2, avatar = $3, last_seen_at = now() where id = $1`, [player.id, name, avatar]);
  return { ...player, name, avatar };
}
