import { SEED_CODECS } from "@/games/codecs";
import { GAMES, GAME_IDS, type GameId } from "@/games/registry";
import { isDifficulty } from "@/shared/engine/difficulty";
import type { PuzzleSpec } from "@/shared/engine/seed-codec";
import type { RoomPlayer, RoundConfig } from "./types";

/**
 * The rules of a challenge room, as pure functions. The route handlers and
 * the pages both use them, and tests/shared/rooms.test.ts covers them.
 *
 * A challenge is a race through a fixed list of puzzles, the same for
 * everyone. A player's clock starts when their first board comes into view
 * and stops when their last round ends. It never pauses: time between rounds
 * and time away from the page both count, which is what keeps it a race.
 */
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;
export const MAX_PLAYERS = 12;
/** Each hint adds this much to the final time. A hint solves part of the puzzle, so it has to cost more than thinking does. */
export const HINT_PENALTY_MS = 30_000;
/** A player whose page has not asked for the room this long is treated as gone: the race does not wait for them. */
export const AWAY_AFTER_MS = 45_000;

/** Letters and digits that are hard to mistake for one another when read aloud or typed from a screenshot. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export function randomRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

/** A code as typed or pasted, cleaned up: upper case, nothing but the alphabet. Null when it cannot be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return code.length === ROOM_CODE_LENGTH && [...code].every((letter) => CODE_ALPHABET.includes(letter)) ? code : null;
}

/** What the host may send for one round. Anything else is dropped or refused. */
export type RoundDraft = { game: GameId; difficulty: string; size?: number | null; lang?: string | null };

/**
 * Checks the host's list of rounds and returns it in canonical form, without
 * tokens. Null when the list is not acceptable: wrong length, an unknown game
 * or difficulty, a size the game does not have.
 */
export function validateRounds(input: unknown): Omit<RoundConfig, "token">[] | null {
  if (!Array.isArray(input) || input.length < MIN_ROUNDS || input.length > MAX_ROUNDS) return null;
  const rounds: Omit<RoundConfig, "token">[] = [];
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return null;
    const draft = entry as Partial<RoundDraft>;
    if (typeof draft.game !== "string" || !(GAME_IDS as readonly string[]).includes(draft.game)) return null;
    if (!isDifficulty(draft.difficulty)) return null;
    const game = GAMES[draft.game];
    const codec = SEED_CODECS[game.id];
    const round: Omit<RoundConfig, "token"> = { game: game.id, difficulty: draft.difficulty };
    if (draft.size !== undefined && draft.size !== null) {
      if (!game.hasSizes || !codec.isBoardSize(draft.size)) return null;
      round.size = draft.size;
    }
    if (draft.lang !== undefined && draft.lang !== null) {
      if (!codec.languages?.supported.includes(draft.lang)) return null;
      round.lang = draft.lang;
    }
    // A game made of words always names its language, so every player gets the same words whatever their own setting is.
    if (codec.languages && !round.lang) round.lang = codec.languages.legacy;
    rounds.push(round);
  }
  return rounds;
}

/** The puzzle of a round, as the spec every player's game builds from. */
export function roundSpec(round: RoundConfig): PuzzleSpec {
  const codec = SEED_CODECS[round.game];
  return codec.withLanguage({ token: round.token, version: codec.currentVersion, difficulty: round.difficulty, ...(round.size !== undefined ? { size: round.size } : {}) }, round.lang);
}

/** Where a round is played: the game's own seeded route, with the room and the round in the query string. */
export function roundPath(code: string, rounds: readonly RoundConfig[], index: number): string {
  const round = rounds[index];
  const seed = SEED_CODECS[round.game].format(roundSpec(round));
  return `${GAMES[round.game].path}/play?seed=${encodeURIComponent(seed)}&room=${code}&round=${index + 1}`;
}

export const roomPath = (code: string): string => `/rooms/${code}`;

export type Standing = {
  player: RoomPlayer;
  /** "waiting": has not seen a board yet. "racing": on a round. "finished": played every round. "gave-up": left the race. */
  state: "waiting" | "racing" | "finished" | "gave-up";
  /** Rounds that ended, solved or not. */
  played: number;
  solved: number;
  hints: number;
  /** Time on the clock: the final time for a finished player, the time so far for the others. Penalties included. Null before the first board. */
  timeMs: number | null;
  penaltyMs: number;
  /** Time each played round took, from the end of the round before it. */
  splitsMs: number[];
  away: boolean;
};

const ms = (iso: string): number => new Date(iso).getTime();

export function standingOf(player: RoomPlayer, totalRounds: number, now: string): Standing {
  const played = player.results.length;
  const solved = player.results.filter((result) => result.solved).length;
  const hints = player.results.reduce((sum, result) => sum + result.hints, 0);
  const penaltyMs = hints * HINT_PENALTY_MS;
  const finished = played >= totalRounds && player.finishedAt !== null;
  const state: Standing["state"] = player.gaveUp ? "gave-up" : finished ? "finished" : player.startedAt ? "racing" : "waiting";

  const splitsMs: number[] = [];
  let previous = player.startedAt ? ms(player.startedAt) : null;
  for (const result of player.results) {
    if (previous === null) break;
    splitsMs.push(Math.max(0, ms(result.at) - previous));
    previous = ms(result.at);
  }

  let timeMs: number | null = null;
  if (player.startedAt) {
    // A player who stopped, by finishing or by giving up, keeps the time of their last round. Everyone else is still on the clock.
    const stoppedAt = finished ? ms(player.finishedAt as string) : player.gaveUp ? (player.results.length > 0 ? ms(player.results[player.results.length - 1].at) : ms(player.startedAt)) : ms(now);
    timeMs = Math.max(0, stoppedAt - ms(player.startedAt)) + penaltyMs;
  }
  return { player, state, played, solved, hints, timeMs, penaltyMs, splitsMs, away: ms(now) - ms(player.seenAt) > AWAY_AFTER_MS };
}

const STATE_ORDER: Record<Standing["state"], number> = { finished: 0, racing: 1, waiting: 2, "gave-up": 3 };

/**
 * The table of a race, best first. More rounds solved always wins, so
 * revealing a puzzle can never beat solving it. Among equals, a player who
 * finished is ahead of one still racing, and the lower time wins.
 */
export function rankRoom(players: readonly RoomPlayer[], totalRounds: number, now: string): Standing[] {
  return players
    .map((player) => standingOf(player, totalRounds, now))
    .sort((a, b) => b.solved - a.solved || STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.played - a.played || (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || ms(a.player.joinedAt) - ms(b.player.joinedAt));
}

/** True once nobody is left racing: every player finished, gave up, or went away. */
export function isRaceOver(players: readonly RoomPlayer[], totalRounds: number, now: string): boolean {
  const standings = players.map((player) => standingOf(player, totalRounds, now));
  return standings.length > 0 && standings.every((standing) => standing.state === "finished" || standing.state === "gave-up" || standing.away);
}

/** The round a player plays next, from 0. Null when they have none left. */
export function nextRound(player: RoomPlayer, totalRounds: number): number | null {
  if (player.gaveUp || player.results.length >= totalRounds) return null;
  return player.results.length;
}
