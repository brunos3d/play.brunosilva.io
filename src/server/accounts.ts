import "server-only";
import { randomUUID } from "node:crypto";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { PLATFORM_NAME } from "@/games/registry";
import { type RelyingParty, relyingPartyFor } from "@/shared/online/relying-party";
import type { Account, DevicePlayer, Me, PasskeyInfo } from "@/shared/online/types";
import { query, t, transaction } from "./db";
import { ApiFailure } from "./http";
import { currentPlayer, devicePlayer, forgetDevicePlayer, forgetSession, openSession, playerById } from "./players";

/**
 * Accounts, which are players with a passkey. A passkey is a key pair made by
 * the player's password manager, phone or security key. The private half
 * never leaves it. The server keeps the public half and checks signatures.
 *
 * Nothing about the kind of authenticator is asked for, so anything that
 * speaks WebAuthn works: Google Password Manager, iCloud Keychain, Windows
 * Hello, 1Password, a phone scanned through a QR code, a YubiKey or another
 * FIDO2 key. The one requirement is a discoverable credential ("resident
 * key"), because signing in starts with no name typed: the authenticator
 * itself says which account it holds.
 *
 * A device that signs in may already have a player of its own, with scores.
 * That player is offered to the account, and joins it only when the person
 * says so: signing in on a friend's computer must not take their points.
 */
const CHALLENGE_COOKIE = "play_challenge";
const CHALLENGE_MAX_AGE = 5 * 60;
const MAX_PASSKEYS = 10;
const LABEL_MAX_LENGTH = 40;

/** The relying party of a request, or a 400 for a request passkeys are not offered to. */
export function relyingParty(request: Request): RelyingParty {
  const party = relyingPartyFor(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  if (!party) throw new ApiFailure(400, "bad-origin");
  return party;
}

async function saveChallenge(challenge: string, kind: "register" | "login", playerId: string | null): Promise<void> {
  const id = randomUUID();
  await transaction([
    // Unused challenges are not worth a scheduled job: each new one sweeps the old ones away.
    { text: `delete from ${t("challenges")} where created_at < now() - interval '10 minutes'` },
    { text: `insert into ${t("challenges")} (id, challenge, kind, player_id) values ($1, $2, $3, $4)`, params: [id, challenge, kind, playerId] },
  ]);
  (await cookies()).set(CHALLENGE_COOKIE, id, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/account", maxAge: CHALLENGE_MAX_AGE });
}

/** Takes the challenge of this ceremony out of the table. It can be answered once. */
async function takeChallenge(kind: "register" | "login", playerId: string | null): Promise<string> {
  const jar = await cookies();
  const id = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete({ name: CHALLENGE_COOKIE, path: "/api/account" });
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new ApiFailure(400, "no-challenge");
  const [row] = await query<{ challenge: string }>(
    `delete from ${t("challenges")} where id = $1 and kind = $2 and player_id is not distinct from $3::uuid and created_at > now() - make_interval(secs => $4) returning challenge`,
    [id, kind, playerId, CHALLENGE_MAX_AGE],
  );
  if (!row) throw new ApiFailure(400, "no-challenge");
  return row.challenge;
}

const cleanLabel = (input: unknown): string => (typeof input === "string" ? input.replace(/[^\p{L}\p{N} .,()-]/gu, "").replace(/\s+/g, " ").trim().slice(0, LABEL_MAX_LENGTH) : "");

type PasskeyRow = { id: string; player_id: string; public_key: string; counter: string | number; transports: string[]; synced: boolean; label: string; created_at: string | Date; last_used_at: string | Date | null };

const toInfo = (row: PasskeyRow): PasskeyInfo => ({
  id: row.id,
  label: row.label,
  createdAt: new Date(row.created_at).toISOString(),
  lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at).toISOString(),
  synced: row.synced,
});

export async function listPasskeys(playerId: string): Promise<PasskeyInfo[]> {
  const rows = await query<PasskeyRow>(`select id, player_id, public_key, counter, transports, synced, label, created_at, last_used_at from ${t("passkeys")} where player_id = $1 order by created_at`, [playerId]);
  return rows.map(toInfo);
}

/** First half of adding a passkey: what the browser hands to the authenticator. */
export async function registrationOptions(player: Me, party: RelyingParty): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await query<PasskeyRow>(`select id, transports from ${t("passkeys")} where player_id = $1`, [player.id]);
  if (existing.length >= MAX_PASSKEYS) throw new ApiFailure(409, "too-many-passkeys");
  const options = await generateRegistrationOptions({
    rpName: PLATFORM_NAME,
    rpID: party.rpID,
    // What the password manager lists the passkey under. The nickname is the part of a player nobody else has.
    userName: player.nickname,
    userDisplayName: player.name,
    userID: new TextEncoder().encode(player.id),
    attestationType: "none",
    // The same authenticator is not asked to hold two passkeys of one account.
    excludeCredentials: existing.map((row) => ({ id: row.id, transports: row.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await saveChallenge(options.challenge, "register", player.id);
  return options;
}

/** Second half: checks what the authenticator answered and stores the public key. The player is an account from here on. */
export async function verifyRegistration(player: Me, party: RelyingParty, response: unknown, label: unknown): Promise<Account> {
  const expectedChallenge = await takeChallenge("register", player.id);
  const result = await verifyRegistrationResponse({ response: response as RegistrationResponseJSON, expectedChallenge, expectedOrigin: party.origin, expectedRPID: party.rpID, requireUserVerification: false }).catch(() => null);
  if (!result?.verified) throw new ApiFailure(400, "passkey-refused");
  const { credential, credentialBackedUp } = result.registrationInfo;
  const [stored] = await query(
    `insert into ${t("passkeys")} (id, player_id, public_key, counter, transports, synced, label)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7) on conflict (id) do nothing returning id`,
    [credential.id, player.id, Buffer.from(credential.publicKey).toString("base64url"), credential.counter, JSON.stringify(credential.transports ?? []), credentialBackedUp, cleanLabel(label)],
  );
  if (!stored) throw new ApiFailure(409, "passkey-exists");
  return readAccount({ ...player, account: true });
}

/** First half of signing in. No account is named: the authenticator offers the ones it holds for this site. */
export async function loginOptions(party: RelyingParty): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({ rpID: party.rpID, userVerification: "preferred", allowCredentials: [] });
  await saveChallenge(options.challenge, "login", null);
  return options;
}

/**
 * Second half of signing in: finds the passkey, checks the signature, and
 * opens a session for its account on this device.
 */
export async function verifyLogin(party: RelyingParty, response: unknown): Promise<Account> {
  const expectedChallenge = await takeChallenge("login", null);
  const answer = response as AuthenticationResponseJSON;
  const id = typeof answer?.id === "string" ? answer.id : "";
  const [row] = await query<PasskeyRow>(`select id, player_id, public_key, counter, transports, synced, label, created_at, last_used_at from ${t("passkeys")} where id = $1`, [id]);
  // The account was deleted, or the passkey belongs to another deployment of the site.
  if (!row) throw new ApiFailure(404, "unknown-passkey");
  const result = await verifyAuthenticationResponse({
    response: answer,
    expectedChallenge,
    expectedOrigin: party.origin,
    expectedRPID: party.rpID,
    credential: { id: row.id, publicKey: new Uint8Array(Buffer.from(row.public_key, "base64url")), counter: Number(row.counter), transports: row.transports },
    requireUserVerification: false,
  }).catch(() => null);
  if (!result?.verified) throw new ApiFailure(400, "passkey-refused");
  await query(`update ${t("passkeys")} set counter = $2, synced = $3, last_used_at = now() where id = $1`, [row.id, result.authenticationInfo.newCounter, result.authenticationInfo.credentialBackedUp]);
  await openSession(row.player_id);
  return readAccount(await playerById(row.player_id));
}

/** Removes a passkey. The last one stays: without it the account could not be reached again, and deleting the account is its own button. */
export async function removePasskey(player: Me, id: string): Promise<Account> {
  const [removed] = await query(
    `delete from ${t("passkeys")} where id = $1 and player_id = $2 and (select count(*) from ${t("passkeys")} where player_id = $2) > 1 returning id`,
    [id, player.id],
  );
  if (!removed) throw new ApiFailure(409, "last-passkey");
  return readAccount(player);
}

/**
 * The player this device had before the account signed in on it, when there is
 * something of theirs to bring along. Never another account: a device player
 * with a passkey of its own belongs to someone who can sign in to it.
 */
async function deviceToMerge(account: Me): Promise<DevicePlayer | null> {
  const device = await devicePlayer();
  if (!device || device.id === account.id || device.account) return null;
  const [totals] = await query(
    `select (select count(*) from ${t("daily_scores")} where player_id = $1)::int as solved,
            (select coalesce(sum(points), 0) from ${t("daily_scores")} where player_id = $1)::int as points,
            (select count(*) from ${t("room_players")} where player_id = $1)::int as rooms`,
    [device.id],
  );
  const solved = Number(totals.solved);
  // A device player that never scored and never raced has nothing to bring. It is dropped without a question.
  if (solved === 0 && Number(totals.rooms) === 0) return null;
  return { id: device.id, name: device.name, nickname: device.nickname, avatar: device.avatar, solved, points: Number(totals.points) };
}

/** Everything the profile page shows about the device and its account. `known` is the player when the caller has just established who it is. */
export async function readAccount(known?: Me | null): Promise<Account> {
  const player = known === undefined ? await currentPlayer() : known;
  if (!player) return { player: null, passkeys: [], device: null };
  return { player, passkeys: await listPasskeys(player.id), device: player.account ? await deviceToMerge(player) : null };
}

/**
 * Moves the device's own player into the account the device is signed in to,
 * and removes that player.
 *
 * - Scores: both may have solved the same daily puzzle. The earlier solve
 *   stays, as it would have on one device, where only the first one counts.
 * - Rooms: the account takes the device player's place, unless it is already
 *   in the same room.
 * - Streak: counted again from the days the merged scores cover.
 *
 * It runs as one transaction, so a failure leaves both players as they were.
 */
export async function mergeDevice(account: Me): Promise<Account> {
  if (!account.account) throw new ApiFailure(403, "not-an-account");
  const device = await devicePlayer();
  if (!device || device.id === account.id || device.account) throw new ApiFailure(409, "nothing-to-merge");
  const ids = [account.id, device.id];
  const gone = [device.id];
  const scores = t("daily_scores");
  await transaction([
    {
      text: `insert into ${scores} (player_id, game, variant, date, number, difficulty, size, elapsed_ms, hints, mistakes, points, created_at)
             select $1, game, variant, date, number, difficulty, size, elapsed_ms, hints, mistakes, points, created_at from ${scores} where player_id = $2
             on conflict (player_id, game, variant, date) do update set
               number = excluded.number, difficulty = excluded.difficulty, size = excluded.size, elapsed_ms = excluded.elapsed_ms,
               hints = excluded.hints, mistakes = excluded.mistakes, points = excluded.points, created_at = excluded.created_at
             where excluded.created_at < ${scores}.created_at`,
      params: ids,
    },
    { text: `delete from ${scores} where player_id = $1`, params: gone },
    {
      text: `update ${t("room_players")} mine set player_id = $1
             where mine.player_id = $2 and not exists (select 1 from ${t("room_players")} theirs where theirs.room_code = mine.room_code and theirs.player_id = $1)`,
      params: ids,
    },
    { text: `delete from ${t("room_players")} where player_id = $1`, params: gone },
    { text: `update ${t("rooms")} set host_id = $1 where host_id = $2`, params: ids },
    {
      // Runs of consecutive days: a date minus its place in the order is the same for every day of one run.
      text: `with days as (select distinct date from ${scores} where player_id = $1),
               runs as (select date, date - (row_number() over (order by date))::int as run from days),
               streaks as (select max(date) as last_day, count(*)::int as length from runs group by run),
               latest as (select last_day, length from streaks order by last_day desc limit 1)
             update ${t("players")} p set
               streak_current = coalesce((select length from latest), p.streak_current),
               streak_date = coalesce((select last_day from latest), p.streak_date),
               streak_best = greatest(p.streak_best, (select streak_best from ${t("players")} where id = $2), coalesce((select max(length) from streaks), 0))
             where p.id = $1`,
      params: ids,
    },
    { text: `delete from ${t("players")} where id = $1`, params: gone },
  ]);
  await forgetDevicePlayer();
  const player = (await playerById(account.id)) ?? account;
  return { player, passkeys: await listPasskeys(player.id), device: null };
}

/**
 * Deletes the current player and everything stored about them: scores, their
 * place in rooms, the rooms they opened, passkeys and sessions. There is no
 * way back, and no copy is kept.
 */
export async function deletePlayer(player: Me): Promise<void> {
  const device = await devicePlayer();
  const id = [player.id];
  await transaction([
    { text: `delete from ${t("daily_scores")} where player_id = $1`, params: id },
    { text: `delete from ${t("room_players")} where player_id = $1`, params: id },
    // A room goes with its host, and takes the other players' rows of it along (on delete cascade).
    { text: `delete from ${t("rooms")} where host_id = $1`, params: id },
    // Passkeys, sessions and pending challenges go with the player (on delete cascade).
    { text: `delete from ${t("players")} where id = $1`, params: id },
  ]);
  // The cookies that pointed at the player go too. A device player that is someone else stays.
  await forgetSession();
  if (device?.id === player.id) await forgetDevicePlayer();
}
