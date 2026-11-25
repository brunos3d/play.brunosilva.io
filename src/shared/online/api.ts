import type { GameId } from "@/games/registry";
import type { RoundDraft } from "./rooms";
import type { Me, Ranking, RankingPeriod, RoomProgress, RoomState, ScoreSubmission } from "./types";

/**
 * The client's side of the route handlers under src/app/api. Every call
 * resolves with the body or rejects with an OnlineError whose `code` the
 * interface maps to a message: "unavailable" (no database), "offline" (no
 * network), or one of the server's own codes such as "no-room".
 */
export class OnlineError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new OnlineError("offline", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new OnlineError(typeof (body as { error?: unknown } | null)?.error === "string" ? (body as { error: string }).error : "server", response.status);
  return body as T;
}

/** What a device may suggest for a player that is about to be created. */
export type PlayerHint = { name?: string; avatar?: string; locale?: string };

export const online = {
  me: () => call<{ player: Me | null }>("/api/session").then((body) => body.player),
  ensureMe: (hint: PlayerHint = {}) => call<{ player: Me }>("/api/session", { method: "POST", body: hint }).then((body) => body.player),
  updateMe: (patch: { name?: string; avatar?: string }) => call<{ player: Me }>("/api/session", { method: "PATCH", body: patch }).then((body) => body.player),

  createRoom: (rounds: readonly RoundDraft[], hint: PlayerHint = {}, rematchOf?: string) => call<{ room: RoomState }>("/api/rooms", { method: "POST", body: { ...hint, rounds, ...(rematchOf ? { rematchOf } : {}) } }).then((body) => body.room),
  room: (code: string) => call<{ room: RoomState }>(`/api/rooms/${code}`).then((body) => body.room),
  joinRoom: (code: string, hint: PlayerHint = {}) => call<{ room: RoomState }>(`/api/rooms/${code}`, { method: "POST", body: { ...hint, action: "join" } }).then((body) => body.room),
  leaveRoom: (code: string) => call<{ ok: true }>(`/api/rooms/${code}`, { method: "POST", body: { action: "leave" } }),
  startRoom: (code: string) => call<{ room: RoomState }>(`/api/rooms/${code}`, { method: "POST", body: { action: "start" } }).then((body) => body.room),
  progress: (code: string, progress: RoomProgress) => call<{ room: RoomState }>(`/api/rooms/${code}`, { method: "POST", body: { ...progress, action: "progress" } }).then((body) => body.room),

  submitScore: (score: ScoreSubmission, hint: PlayerHint = {}) => call<{ points: number; recorded: boolean }>("/api/scores", { method: "POST", body: { ...hint, ...score } }),
  ranking: (period: RankingPeriod, game: GameId | "all", variant = "") => call<{ ranking: Ranking }>(`/api/ranking?period=${period}&game=${game}${variant ? `&variant=${variant}` : ""}`).then((body) => body.ranking),
};
