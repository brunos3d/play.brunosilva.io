import type { GameId } from "@/games/registry";
import type { Difficulty } from "@/shared/engine/difficulty";

/**
 * What the online features send over the wire. Shared by the route handlers
 * under src/app/api and by the client, so the two cannot drift apart.
 * Timestamps are ISO strings from the database's clock.
 */

/**
 * A player as others see them. There is nothing personal in it: a display name
 * they picked, a nickname nobody else has, and the seed of a generated avatar.
 */
export type PublicPlayer = { id: string; name: string; nickname: string; avatar: string };

/** The player behind the request, from its cookies. `account` is true once the player has a passkey, and so can be reached from another device. */
export type Me = PublicPlayer & { streak: number; bestStreak: number; account: boolean };

/** A passkey of the account, as its owner sees it. The key itself never leaves the server. */
export type PasskeyInfo = {
  id: string;
  /** Where it was made, as the browser described itself: "Chrome on Android". */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** True when the passkey is kept by a password manager that syncs it, false when it lives on one device or key. */
  synced: boolean;
};

/** The player this device had before someone signed in on it, when that player has scores that could join the account. */
export type DevicePlayer = PublicPlayer & { solved: number; points: number };

/** What the profile page shows. */
export type Account = { player: Me | null; passkeys: PasskeyInfo[]; device: DevicePlayer | null };

/** One puzzle of a challenge. The host picks the first four fields. The server adds the token, which makes the seed. */
export type RoundConfig = {
  game: GameId;
  difficulty: Difficulty;
  /** Board edge. Missing means the difficulty picks it. */
  size?: number;
  /** Language of the words, for the games made of words. */
  lang?: string;
  /** The free part of the seed. Empty until the race starts, so nobody can open a board early. */
  token: string;
};

/** How a round ended for a player. `at` is when the server heard about it. */
export type RoundResult = { at: string; solved: boolean; hints: number };

export type RoomStatus = "lobby" | "racing" | "finished";

export type RoomPlayer = PublicPlayer & {
  joinedAt: string;
  /** Last time this player's page asked for the room. */
  seenAt: string;
  /** When their first board came into view. Their clock runs from here. */
  startedAt: string | null;
  results: RoundResult[];
  finishedAt: string | null;
  gaveUp: boolean;
};

export type RoomState = {
  code: string;
  status: RoomStatus;
  hostId: string;
  rounds: RoundConfig[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** A new room the host opened with the same settings, for another race. */
  rematchCode: string | null;
  players: RoomPlayer[];
  /** The id of the player asking, or null for someone who has not joined. */
  you: string | null;
  /** The server's clock, so every client measures time against the same one. */
  now: string;
};

/** What a client reports while racing. */
export type RoomProgress =
  /** The board of this round is on screen. The first one starts the player's clock. */
  | { event: "view"; round: number }
  /** The round ended: solved, or given up on with Reveal or by running out of guesses. */
  | { event: "round"; round: number; solved: boolean; hints: number }
  | { event: "give-up" };

export type ApiError = { error: string };

/** One row of a ranking. */
export type RankingEntry = PublicPlayer & {
  rank: number;
  /** Points, for a ranking by points. */
  points: number;
  /** Solve time in milliseconds, for the ranking of one game on one day. */
  elapsedMs?: number;
  hints?: number;
  /** Daily puzzles behind the points. */
  solved: number;
  streak: number;
};

/** "week" is Monday to Sunday and "month" the calendar month, both on the Pacific calendar. "all" has no start. */
export type RankingPeriod = "today" | "week" | "month" | "all";
export const RANKING_PERIODS: readonly RankingPeriod[] = ["today", "week", "month", "all"];

export type Ranking = {
  period: RankingPeriod;
  game: GameId | "all";
  /** First and last Pacific date counted, inclusive. */
  from: string;
  to: string;
  entries: RankingEntry[];
  /** The asking player's own row when it is not among the entries. */
  you: RankingEntry | null;
  players: number;
};

/** A finished daily puzzle, as the client reports it. */
export type ScoreSubmission = {
  game: GameId;
  /** Language of the puzzle for games with one daily per language, as in DailyInfo.variant. */
  variant?: string;
  date: string;
  number: number;
  difficulty: Difficulty;
  size: number;
  elapsedMs: number;
  hintsUsed: number;
  mistakes: number;
};
