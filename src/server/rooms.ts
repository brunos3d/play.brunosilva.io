import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { MAX_PLAYERS, isRaceOver, normalizeRoomCode, randomRoomCode, validateRounds } from "@/shared/online/rooms";
import type { Me, RoomPlayer, RoomProgress, RoomState, RoundConfig } from "@/shared/online/types";
import { type Row, query, t, transaction } from "./db";
import { ApiFailure } from "./http";

/**
 * Challenge rooms on the server. A room is one row, and each player in it is
 * one row. Every change is a single conditional statement, so two requests
 * arriving together cannot start a room twice or record a round twice, and no
 * request ever holds a lock across a round trip.
 *
 * Time is the database's clock, never the client's. A player cannot shorten
 * their race by changing the clock of their device.
 */

/** Rooms are short-lived. Old ones are removed when a new one is created, so the table stays small without a scheduled job. */
const ROOM_LIFETIME = "36 hours";
const ROOMS_PER_HOUR = 30;

const SELECT_ROOM = `
  select r.code, r.status, r.host_id, r.rounds, r.created_at, r.started_at, r.finished_at, r.rematch_code, now() as now,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'nickname', p.nickname, 'avatar', p.avatar,
        'joinedAt', rp.joined_at, 'seenAt', rp.last_seen_at, 'startedAt', rp.started_at,
        'results', rp.results, 'finishedAt', rp.finished_at, 'gaveUp', rp.gave_up
      ) order by rp.joined_at, p.id)
      from ${t("room_players")} rp join ${t("players")} p on p.id = rp.player_id
      where rp.room_code = r.code
    ), '[]'::jsonb) as players
  from ${t("rooms")} r where r.code = $1`;

const iso = (value: unknown): string => new Date(value as string | Date).toISOString();
const isoOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : iso(value));

function toState(row: Row, you: string | null): RoomState {
  const status = row.status as RoomState["status"];
  const players = (row.players as (Omit<RoomPlayer, "joinedAt" | "seenAt"> & { joinedAt: string; seenAt: string })[]).map((player) => ({
    ...player,
    joinedAt: iso(player.joinedAt),
    seenAt: iso(player.seenAt),
    startedAt: isoOrNull(player.startedAt),
    finishedAt: isoOrNull(player.finishedAt),
    results: player.results.map((result) => ({ ...result, at: iso(result.at) })),
  }));
  // The tokens make the seeds. In the lobby they stay on the server, so no one can open a board before the start.
  const rounds = (row.rounds as RoundConfig[]).map((round) => (status === "lobby" ? { ...round, token: "" } : round));
  return {
    code: row.code as string,
    status,
    hostId: row.host_id as string,
    rounds,
    createdAt: iso(row.created_at),
    startedAt: isoOrNull(row.started_at),
    finishedAt: isoOrNull(row.finished_at),
    rematchCode: (row.rematch_code as string | null) ?? null,
    players,
    you: you !== null && players.some((player) => player.id === you) ? you : null,
    now: iso(row.now),
  };
}

export function requireCode(input: string): string {
  const code = normalizeRoomCode(input);
  if (!code) throw new ApiFailure(404, "no-room");
  return code;
}

/** A seed token nobody can guess. It is only letters and digits, so it passes the seed codec unchanged. */
const roundToken = (): string => `r${randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x")}`;

export async function createRoom(host: Me, roundsInput: unknown, rematchOf?: string | null): Promise<RoomState> {
  const drafts = validateRounds(roundsInput);
  if (!drafts) throw new ApiFailure(400, "invalid-rounds");
  const rounds: RoundConfig[] = drafts.map((draft) => ({ ...draft, token: roundToken() }));

  const [recent] = await query<{ count: number }>(`select count(*)::int as count from ${t("rooms")} where host_id = $1 and created_at > now() - interval '1 hour'`, [host.id]);
  if ((recent?.count ?? 0) >= ROOMS_PER_HOUR) throw new ApiFailure(429, "too-many-rooms");

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomRoomCode(() => randomInt(0, 1_000_000) / 1_000_000);
    const [created] = await transaction([
      { text: `delete from ${t("rooms")} where created_at < now() - interval '${ROOM_LIFETIME}'` },
      { text: `insert into ${t("rooms")} (code, host_id, rounds) values ($1, $2, $3::jsonb) on conflict (code) do nothing returning code`, params: [code, host.id, JSON.stringify(rounds)] },
    ]).then((results) => results[1]);
    if (!created) continue;
    await query(`insert into ${t("room_players")} (room_code, player_id) values ($1, $2)`, [code, host.id]);
    // A rematch is announced in the old room, so the players still looking at its table can follow.
    if (rematchOf) await query(`update ${t("rooms")} set rematch_code = $2 where code = $1 and host_id = $3`, [rematchOf, code, host.id]);
    return readRoom(code, host.id);
  }
  throw new ApiFailure(503, "no-code");
}

/**
 * The room as the asking player sees it. Reading is also the heartbeat: it
 * marks the player as present, at most once every few seconds, and it is where
 * a race is closed once nobody is left racing.
 */
export async function readRoom(code: string, playerId: string | null): Promise<RoomState> {
  const statements = [{ text: SELECT_ROOM, params: [code] as unknown[] }];
  if (playerId) statements.unshift({ text: `update ${t("room_players")} set last_seen_at = now() where room_code = $1 and player_id = $2 and last_seen_at < now() - interval '5 seconds'`, params: [code, playerId] });
  const results = await transaction(statements);
  const [row] = results[results.length - 1];
  if (!row) throw new ApiFailure(404, "no-room");
  const state = toState(row, playerId);

  if (state.status === "racing" && isRaceOver(state.players, state.rounds.length, state.now)) {
    await query(`update ${t("rooms")} set status = 'finished', finished_at = now() where code = $1 and status = 'racing'`, [code]);
    return { ...state, status: "finished", finishedAt: state.now };
  }
  // A lobby whose host went away would never start. The player who has been there longest takes over.
  if (state.status === "lobby") {
    const present = state.players.filter((player) => new Date(state.now).getTime() - new Date(player.seenAt).getTime() < 60_000);
    if (present.length > 0 && !present.some((player) => player.id === state.hostId)) {
      await query(`update ${t("rooms")} set host_id = $2 where code = $1 and status = 'lobby' and host_id = $3`, [code, present[0].id, state.hostId]);
      return { ...state, hostId: present[0].id };
    }
  }
  return state;
}

/** Adds the player to the room. Joining twice is harmless. A race in progress can still be joined: a late player's clock starts at their own first board. */
export async function joinRoom(code: string, player: Me): Promise<RoomState> {
  const [joined] = await query(
    `insert into ${t("room_players")} (room_code, player_id)
     select r.code, $2 from ${t("rooms")} r
     where r.code = $1 and r.status <> 'finished'
       and (select count(*) from ${t("room_players")} where room_code = $1) < $3
     on conflict (room_code, player_id) do update set last_seen_at = now()
     returning room_code`,
    [code, player.id, MAX_PLAYERS],
  );
  if (!joined) {
    const state = await readRoom(code, player.id);
    if (state.you) return state;
    throw new ApiFailure(409, state.status === "finished" ? "room-finished" : "room-full");
  }
  return readRoom(code, player.id);
}

/** Leaves a lobby. Once the race is on, leaving is giving up, which keeps the player in the table. */
export async function leaveRoom(code: string, player: Me): Promise<void> {
  await query(`delete from ${t("room_players")} rp using ${t("rooms")} r where rp.room_code = $1 and rp.player_id = $2 and r.code = rp.room_code and r.status = 'lobby'`, [code, player.id]);
}

export async function startRoom(code: string, player: Me): Promise<RoomState> {
  const [started] = await query(`update ${t("rooms")} set status = 'racing', started_at = now() where code = $1 and host_id = $2 and status = 'lobby' returning code`, [code, player.id]);
  const state = await readRoom(code, player.id);
  if (!started && state.status === "lobby") throw new ApiFailure(403, "not-host");
  return state;
}

function parseProgress(body: Record<string, unknown>): RoomProgress | null {
  const round = body.round;
  const validRound = typeof round === "number" && Number.isInteger(round) && round >= 1 && round <= 10;
  if (body.event === "give-up") return { event: "give-up" };
  if (body.event === "view" && validRound) return { event: "view", round };
  if (body.event === "round" && validRound && typeof body.solved === "boolean") {
    const hints = typeof body.hints === "number" && Number.isInteger(body.hints) ? Math.max(0, Math.min(body.hints, 500)) : 0;
    return { event: "round", round, solved: body.solved, hints };
  }
  return null;
}

/**
 * Records what a racing player reports. Rounds are taken in order and once
 * each: the statement only applies when the round reported is the next one,
 * so a retry or a second tab cannot add a result twice or skip ahead.
 */
export async function recordProgress(code: string, player: Me, body: Record<string, unknown>): Promise<RoomState> {
  const progress = parseProgress(body);
  if (!progress) throw new ApiFailure(400, "invalid-progress");
  const racing = `exists (select 1 from ${t("rooms")} r where r.code = $1 and r.status <> 'lobby')`;

  if (progress.event === "view") {
    await query(`update ${t("room_players")} set started_at = coalesce(started_at, now()), last_seen_at = now() where room_code = $1 and player_id = $2 and not gave_up and ${racing}`, [code, player.id]);
  } else if (progress.event === "give-up") {
    await query(`update ${t("room_players")} set gave_up = true, last_seen_at = now() where room_code = $1 and player_id = $2 and finished_at is null and ${racing}`, [code, player.id]);
  } else {
    await query(
      `update ${t("room_players")} rp set
         started_at = coalesce(rp.started_at, now()),
         results = rp.results || jsonb_build_array(jsonb_build_object('at', now(), 'solved', $4::boolean, 'hints', $5::int)),
         finished_at = case when jsonb_array_length(rp.results) + 1 >= jsonb_array_length(r.rounds) then now() else null end,
         last_seen_at = now()
       from ${t("rooms")} r
       where rp.room_code = $1 and rp.player_id = $2 and r.code = rp.room_code and r.status <> 'lobby'
         and not rp.gave_up and rp.finished_at is null
         and jsonb_array_length(rp.results) = $3::int - 1
         and $3::int <= jsonb_array_length(r.rounds)`,
      [code, player.id, progress.round, progress.solved, progress.hints],
    );
  }
  return readRoom(code, player.id);
}
