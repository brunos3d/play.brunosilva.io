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
  moves?: number;
  /** The player asked for the solution. The day closes without points. */
  revealed?: boolean;
  /** The game was lost. Comes with `revealed`. */
  failed?: boolean;
  /** The finished board as the game saved it. Each game owns the shape. */
  board?: unknown;
};

export type DailyOutcome = "solved" | "revealed" | "failed";

/**
 * A closed daily of a player, as the server keeps it: the first way the
 * puzzle ended for them, on any device. Number, difficulty and seed are the
 * server's own, read from the game's daily schedule.
 */
export type DailyRecord = {
  game: GameId;
  variant: string;
  date: string;
  /** The id the game stores this puzzle's board under, so a device can find it without knowing the game. */
  puzzleId: string;
  number: number;
  difficulty: Difficulty;
  size: number;
  seed: string;
  outcome: DailyOutcome;
  elapsedMs: number;
  hints: number;
  mistakes: number;
  moves: number;
  points: number;
  /** Only sent for the days that can still be played, and null when no device has uploaded it. */
  board: unknown;
};

/** A daily the player has opened and not closed. Time travels as "this long ago", since two devices do not share a clock. */
export type DailyOpen = { game: GameId; variant: string; date: string; openedAgoMs: number; hints: number };

/** Everything a device needs to show the player's dailies as they stand on the account. `player` is null for a device without one. */
export type DailyState = {
  player: string | null;
  today: string;
  records: DailyRecord[];
  opens: DailyOpen[];
  /** True on a site that runs without a database. Said in a normal answer, so a page that asks on every load does not log an error on every load. */
  unavailable?: boolean;
};

/** The answer to a submission. `record` is how the daily stands for the player, which is not this submission when another device closed it first. */
export type ScoreAnswer = {
  points: number;
  recorded: boolean;
  record: DailyRecord | null;
  /** Whose record it is: the player the request acted as, which a first solve has just created. Null when nobody was there to close the day for. */
  player: string | null;
};
