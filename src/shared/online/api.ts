import type { GameId } from "@/games/registry";
import type { RoundDraft } from "./rooms";
import type { Account, DailyState, Me, Ranking, RankingPeriod, RoomProgress, RoomState, ScoreAnswer, ScoreSubmission } from "./types";

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

async function call<T>(path: string, init?: { method: string; body?: unknown; keepalive?: boolean }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
      // A report that has to arrive even when the player closes the tab right after it.
      ...(init?.keepalive ? { keepalive: true } : {}),
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
  updateMe: (patch: { name?: string; nickname?: string; avatar?: string }) => call<{ player: Me }>("/api/session", { method: "PATCH", body: patch }).then((body) => body.player),

  /** The profile page's view of the device: its player, the account's passkeys, and a device player that could join the account. */
  account: () => call<Account>("/api/account"),
  /** The two halves of adding a passkey. `options` and `response` are WebAuthn's own JSON, passed through untouched. */
  passkeyOptions: (hint: PlayerHint = {}) => call<{ options: unknown }>("/api/account/register", { method: "POST", body: { ...hint, action: "options" } }).then((body) => body.options),
  passkeyVerify: (response: unknown, label: string) => call<Account>("/api/account/register", { method: "POST", body: { action: "verify", response, label } }),
  /** The two halves of signing in with a passkey. */
  loginOptions: () => call<{ options: unknown }>("/api/account/login", { method: "POST", body: { action: "options" } }).then((body) => body.options),
  loginVerify: (response: unknown) => call<Account>("/api/account/login", { method: "POST", body: { action: "verify", response } }),
  removePasskey: (id: string) => call<Account>(`/api/account/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" }),
  signOut: () => call<{ ok: true }>("/api/account/logout", { method: "POST", body: {} }),
  mergeDevice: () => call<Account>("/api/account/merge", { method: "POST", body: {} }),
  deleteAccount: () => call<{ ok: true }>("/api/account", { method: "DELETE" }),

  createRoom: (rounds: readonly RoundDraft[], hint: PlayerHint = {}, rematchOf?: string) => call<{ room: RoomState }>("/api/rooms", { method: "POST", body: { ...hint, rounds, ...(rematchOf ? { rematchOf } : {}) } }).then((body) => body.room),
  room: (code: string) => call<{ room: RoomState }>(`/api/rooms/${code}`).then((body) => body.room),
  joinRoom: (code: string, hint: PlayerHint = {}) => call<{ room: RoomState }>(`/api/rooms/${code}`, { method: "POST", body: { ...hint, action: "join" } }).then((body) => body.room),
  leaveRoom: (code: string) => call<{ ok: true }>(`/api/rooms/${code}`, { method: "POST", body: { action: "leave" } }),
  startRoom: (code: string) => call<{ room: RoomState }>(`/api/rooms/${code}`, { method: "POST", body: { action: "start" } }).then((body) => body.room),
  progress: (code: string, progress: RoomProgress) => call<{ room: RoomState }>(`/api/rooms/${code}`, { method: "POST", body: { ...progress, action: "progress" } }).then((body) => body.room),

  submitScore: (score: ScoreSubmission, hint: PlayerHint = {}) => call<ScoreAnswer>("/api/scores", { method: "POST", body: { ...hint, ...score }, keepalive: true }),
  /** How the player's dailies stand on the server: closed ones, and the open ones of today and yesterday. */
  daily: () => call<DailyState>("/api/daily"),
  /** Tells the server a daily is open on this device, and how many hints it has used. */
  openDaily: (daily: { game: GameId; variant?: string; date: string; hints: number }) => call<{ openedAgoMs: number | null }>("/api/daily", { method: "POST", body: daily }),
  ranking: (period: RankingPeriod, game: GameId | "all", variant = "") => call<{ ranking: Ranking }>(`/api/ranking?period=${period}&game=${game}${variant ? `&variant=${variant}` : ""}`).then((body) => body.ranking),
};
