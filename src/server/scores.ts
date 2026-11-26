import "server-only";
import { DAILY_GAMES, dailyInfoOf } from "@/games/daily";
import { GAME_IDS, type GameId, isDailyVariant } from "@/games/registry";
import { addDays, isDateKey, pacificDateKey } from "@/shared/engine/pacific-time";
import { HINT_COST, MIN_SOLVE_POINTS, PAR_MS, RANKING_HINT_MS, SOLVE_POINTS, SPEED_BONUS, parseScore, scorePoints } from "@/shared/online/scores";
import { type DailyOutcome, type DailyRecord, type DailyState, type Me, RANKING_PERIODS, type Ranking, type RankingEntry, type RankingPeriod, type ScoreAnswer } from "@/shared/online/types";
import { type Row, query, t } from "./db";
import { ApiFailure } from "./http";

/**
 * Closed daily puzzles and the rankings built from them. The first way a
 * player closes the daily of a game, language and date is the one that
 * counts, as on the device, and it counts on every device of the player.
 * Dates are Pacific calendar dates, the calendar of the daily puzzles.
 *
 * The times are reported by the player's own device. Nothing here can prove a
 * solve was honest. The checks only keep out what cannot be true: a date that
 * is not today's puzzle, an impossible time. A ranking for fun does not need
 * more, and this is the place to add it if one day it does.
 */
const PACIFIC_TODAY = "(now() at time zone 'America/Los_Angeles')::date";
/** The first day each period counts, as SQL. */
const FROM: Record<RankingPeriod, string> = {
  today: PACIFIC_TODAY,
  week: `date_trunc('week', ${PACIFIC_TODAY}::timestamp)::date`,
  month: `date_trunc('month', ${PACIFIC_TODAY}::timestamp)::date`,
  all: "'-infinity'::date",
};
const TOP = 50;

/** A submission may trail the server's own clock by this much before the server's time is used instead: the request takes a moment to arrive. */
export const CLOCK_SLACK_MS = 5_000;
/** A puzzle opened before midnight Pacific may end after it. Without a record of the open, yesterday's puzzle is taken this many hours into the new day. */
const LATE_FINISH_HOURS = 6;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** `scorePoints` as SQL, for the one place that has to score rows without leaving the database: a merge. Built from the same constants. */
export const pointsSql = (difficulty: string, elapsedMs: string, hints: string): string =>
  `(greatest(${MIN_SOLVE_POINTS}, ${SOLVE_POINTS} - ${HINT_COST} * ${hints}) + round(${SPEED_BONUS} * least(1, (case ${difficulty} ${Object.entries(PAR_MS)
    .map(([tier, par]) => `when '${tier}' then ${par}`)
    .join(" ")} else ${PAR_MS.expert} end)::numeric / greatest(${elapsedMs}, 1))))::int`;
/** How far back a device is told about the player's dailies. Enough for any streak worth showing. */
const HISTORY_DAYS = 400;

const RECORD_COLUMNS = "game, variant, date::text as date, number, difficulty, size, seed, outcome, elapsed_ms, hints, mistakes, moves, points";

function toRecord(row: Row): DailyRecord {
  const game = row.game as GameId;
  const variant = row.variant as string;
  const date = row.date as string;
  // Rows from before the seed was stored get it from the schedule, which is where it came from in the first place.
  const seed = (row.seed as string | null) ?? dailyInfoOf(game, date, variant).seed;
  return {
    game,
    variant,
    date,
    puzzleId: DAILY_GAMES[game].puzzleId(seed),
    number: Number(row.number),
    difficulty: row.difficulty as DailyRecord["difficulty"],
    size: Number(row.size),
    seed,
    outcome: row.outcome as DailyOutcome,
    elapsedMs: Number(row.elapsed_ms),
    hints: Number(row.hints),
    mistakes: Number(row.mistakes),
    moves: Number(row.moves),
    points: Number(row.points),
    board: row.board ?? null,
  };
}

/**
 * Closes a daily puzzle for a player: solved, revealed or lost. The first
 * close of a game, language and date is the one that counts, on whichever
 * device it happens, so a puzzle given up on one device cannot be solved for
 * points on another. Only a solved one has points and moves the streak.
 *
 * What the device reports is taken with care:
 * - number, difficulty and seed come from the game's own daily schedule, not
 *   from the request;
 * - when the server saw the player open the puzzle, the time is at least the
 *   time since then, and the hints at least the most any device reported;
 * - yesterday's puzzle counts only when it was opened before midnight
 *   Pacific, or in the first hours of the new day.
 *
 * `recorded` is false when the daily was already closed, or is not one that
 * can be played now. `record` is how it stands for the player either way.
 */
export async function submitScore(player: Me, body: Record<string, unknown>): Promise<ScoreAnswer> {
  const score = parseScore(body);
  if (!score) throw new ApiFailure(400, "invalid-score");
  const variant = score.variant ?? "";
  const key = [player.id, score.game, variant, score.date];

  const [now] = await query(
    `select ${PACIFIC_TODAY}::text as today, extract(hour from (now() at time zone 'America/Los_Angeles'))::int as hour,
       o.open_ms, o.hints, o.opened_day
     from (select 1) one
     left join (
       select (extract(epoch from (now() - opened_at)) * 1000)::bigint as open_ms, hints, ((opened_at at time zone 'America/Los_Angeles')::date)::text as opened_day
       from ${t("daily_opens")} where player_id = $1 and game = $2 and variant = $3 and date = $4::date
     ) o on true`,
    key,
  );
  const today = now.today as string;
  const opened = now.opened_day !== null && now.opened_day !== undefined;
  const playable = score.date === today || (score.date === addDays(today, -1) && ((opened && (now.opened_day as string) < today) || Number(now.hour) < LATE_FINISH_HOURS));

  const info = dailyInfoOf(score.game, score.date, variant);
  const outcome: DailyOutcome = score.failed ? "failed" : score.revealed ? "revealed" : "solved";
  const sinceOpen = opened ? Number(now.open_ms) : 0;
  const elapsedMs = Math.min(DAY_MS, sinceOpen > score.elapsedMs + CLOCK_SLACK_MS ? sinceOpen : score.elapsedMs);
  const hints = Math.max(score.hintsUsed, opened ? Number(now.hints) : 0);
  const points = outcome === "solved" ? scorePoints(info.difficulty, elapsedMs, hints) : 0;
  const board = score.board === undefined ? null : JSON.stringify(score.board);

  let inserted = false;
  if (playable) {
    // The conflict branch never changes how the daily ended, its time, its hints or its points. It completes a close that
    // arrived without its board: a reveal is reported as soon as the board is known to be locked by it, and the finished
    // board follows with the counts of mistakes and moves once the solution has played out.
    const [row] = await query(
      `insert into ${t("daily_scores")} (player_id, game, variant, date, number, difficulty, size, elapsed_ms, hints, mistakes, points, outcome, moves, seed, board)
       values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
       on conflict (player_id, game, variant, date) do update set board = excluded.board, mistakes = excluded.mistakes, moves = excluded.moves
         where ${t("daily_scores")}.board is null and excluded.board is not null and ${t("daily_scores")}.outcome = excluded.outcome
       returning (xmax = 0) as inserted`,
      [...key, info.number, info.difficulty, score.size, elapsedMs, hints, score.mistakes, points, outcome, score.moves ?? 0, info.seed, board],
    );
    inserted = row?.inserted === true;
  } else if (board !== null) {
    // Too late to close this daily, and not too late to complete a close that is there: the board of yesterday's puzzle
    // still travels to the player's other devices, whenever the device that has it gets to send it.
    await query(
      `update ${t("daily_scores")} set board = $5::jsonb, mistakes = $6, moves = $7
       where player_id = $1 and game = $2 and variant = $3 and date = $4::date and date >= ${PACIFIC_TODAY} - 1 and board is null and outcome = $8`,
      [...key, board, score.mistakes, score.moves ?? 0, outcome],
    );
  }

  if (inserted && outcome === "solved") {
    // One more day on the streak when the last counted day was the day before, the same streak for a second game on the same day, a new streak otherwise.
    const next = "case when streak_date = $2::date then streak_current when streak_date = $2::date - 1 then streak_current + 1 else 1 end";
    await query(
      `update ${t("players")} set
         streak_current = ${next},
         streak_best = greatest(streak_best, ${next}),
         streak_date = $2::date,
         last_seen_at = now()
       where id = $1 and (streak_date is null or streak_date <= $2::date)`,
      [player.id, score.date],
    );
  }

  const [stored] = await query(`select ${RECORD_COLUMNS}, board from ${t("daily_scores")} where player_id = $1 and game = $2 and variant = $3 and date = $4::date`, key);
  return { points: inserted ? points : 0, recorded: inserted, record: stored ? toRecord(stored) : null, player: player.id };
}

/**
 * Notes that the player has a daily open, and how many hints they have used
 * on it so far. The first call sets the time, by the server's clock, and no
 * later one moves it. Hints only go up. Answers how long ago the puzzle was
 * first opened, or null for a puzzle that cannot be played now.
 */
export async function openDaily(player: Me, body: Record<string, unknown>): Promise<{ openedAgoMs: number | null }> {
  const game = body.game;
  const variant = body.variant === undefined || body.variant === null ? "" : body.variant;
  if (typeof game !== "string" || !(GAME_IDS as readonly string[]).includes(game) || typeof variant !== "string" || !isDailyVariant(game as GameId, variant)) throw new ApiFailure(400, "invalid-daily");
  if (typeof body.date !== "string" || !isDateKey(body.date)) throw new ApiFailure(400, "invalid-daily");
  const hints = typeof body.hints === "number" && Number.isInteger(body.hints) ? Math.max(0, Math.min(body.hints, 500)) : 0;
  const [row] = await query(
    // A record of an open is only of use while its puzzle can be played, and so is a board: it travels to the player's
    // other devices for today and yesterday. Each open, by anyone, sweeps away what is past that, for everyone.
    `with swept as (delete from ${t("daily_opens")} where date < ${PACIFIC_TODAY} - 1),
       cleared as (update ${t("daily_scores")} set board = null where date < ${PACIFIC_TODAY} - 1 and board is not null)
     insert into ${t("daily_opens")} (player_id, game, variant, date, hints)
     select $1, $2, $3, $4::date, $5 where $4::date between ${PACIFIC_TODAY} - 1 and ${PACIFIC_TODAY}
     on conflict (player_id, game, variant, date) do update set hints = greatest(${t("daily_opens")}.hints, excluded.hints)
     returning (extract(epoch from (now() - opened_at)) * 1000)::bigint as open_ms`,
    [player.id, game, variant, body.date, hints],
  );
  return { openedAgoMs: row ? Number(row.open_ms) : null };
}

/**
 * How the player's dailies stand: every close of the last year and a bit,
 * and the puzzles of today and yesterday that are open. Boards travel only
 * for those two days, the ones a device could still offer to play.
 */
export async function readDaily(player: Me | null): Promise<DailyState> {
  // Most visitors have no player. They are answered without a trip to the database: every daily page waits on this.
  if (!player) return { player: null, today: pacificDateKey(new Date()), records: [], opens: [] };
  const [clock] = await query(`select ${PACIFIC_TODAY}::text as today`);
  const today = clock.today as string;
  const records = await query(
    `select ${RECORD_COLUMNS}, case when date >= ${PACIFIC_TODAY} - 1 then board else null end as board
     from ${t("daily_scores")} where player_id = $1 and date >= ${PACIFIC_TODAY} - ${HISTORY_DAYS} order by date, game, variant`,
    [player.id],
  );
  const opens = await query(
    `select game, variant, date::text as date, (extract(epoch from (now() - opened_at)) * 1000)::bigint as open_ms, hints
     from ${t("daily_opens")} where player_id = $1 and date >= ${PACIFIC_TODAY} - 1`,
    [player.id],
  );
  return {
    player: player.id,
    today,
    records: records.map((row) => toRecord(row)),
    opens: opens.map((row) => ({ game: row.game as GameId, variant: row.variant as string, date: row.date as string, openedAgoMs: Number(row.open_ms), hints: Number(row.hints) })),
  };
}

const toEntry = (row: Row, byTime: boolean): RankingEntry => ({
  id: row.id as string,
  name: row.name as string,
  nickname: row.nickname as string,
  avatar: row.avatar as string,
  rank: Number(row.rank),
  points: Number(row.points),
  solved: Number(row.solved),
  streak: Number(row.streak),
  ...(byTime ? { elapsedMs: Number(row.elapsed_ms), hints: Number(row.hints) } : {}),
});

export function parseRankingQuery(params: URLSearchParams): { period: RankingPeriod; game: GameId | "all"; variant: string } {
  const asked = params.get("period");
  const period: RankingPeriod = RANKING_PERIODS.find((known) => known === asked) ?? "today";
  const requested = params.get("game");
  const game = requested && (GAME_IDS as readonly string[]).includes(requested) ? (requested as GameId) : "all";
  const variant = params.get("variant") ?? "";
  return { period, game, variant: /^[a-z-]{0,8}$/.test(variant) ? variant : "" };
}

/**
 * A ranking, best first, with the asking player's own row when they are below
 * the cut.
 *
 * - One game, today: by time, because everyone solved the same puzzle. A hint
 *   counts as 30 seconds. For a game with one daily per language, `variant`
 *   picks the language, since each has its own puzzle.
 * - Everything else: by points, summed over the games and days in range. A
 *   week runs from Monday to Sunday, a month is the calendar month, and "all"
 *   starts with the first score ever recorded.
 */
export async function readRanking(me: Me | null, period: RankingPeriod, game: GameId | "all", variant: string): Promise<Ranking> {
  const byTime = period === "today" && game !== "all";
  const from = FROM[period];
  const params: unknown[] = [me?.id ?? null, TOP];
  // A revealed or lost daily is a row too, with no points. It closes the day and is not part of any ranking.
  const filters = [`s.date between ${from} and ${PACIFIC_TODAY}`, "s.outcome = 'solved'"];
  if (game !== "all") {
    params.push(game);
    filters.push(`s.game = $${params.length}`);
  }
  if (byTime) {
    params.push(variant);
    filters.push(`s.variant = $${params.length}`);
  }
  const where = filters.join(" and ");

  const streak = `case when p.streak_date >= ${PACIFIC_TODAY} - 1 then p.streak_current else 0 end`;
  const totals = byTime
    ? `select s.player_id, s.points, 1 as solved, s.elapsed_ms, s.hints, s.elapsed_ms + s.hints * ${RANKING_HINT_MS} as score_time, s.created_at as reached from ${t("daily_scores")} s where ${where}`
    : `select s.player_id, sum(s.points)::int as points, count(*)::int as solved, 0 as elapsed_ms, 0 as hints, 0 as score_time, max(s.created_at) as reached from ${t("daily_scores")} s where ${where} group by s.player_id`;
  // Ties share a rank. Whoever got there first is listed first.
  const order = byTime ? "score_time asc" : "points desc";

  const rows = await query(
    `with totals as (${totals}),
     ranked as (
       select totals.*, rank() over (order by ${order}) as rank, row_number() over (order by ${order}, reached asc) as position, count(*) over () as players
       from totals
     )
     select p.id, p.name, p.nickname, p.avatar, ${streak} as streak, ranked.rank, ranked.points, ranked.solved, ranked.elapsed_ms, ranked.hints, ranked.players, ranked.position
     from ranked join ${t("players")} p on p.id = ranked.player_id
     where ranked.position <= $2 or p.id = $1::uuid
     order by ranked.position`,
    params,
  );
  // "All" starts where the scores do, so the page can say since when.
  const first = period === "all" ? `coalesce((select min(date) from ${t("daily_scores")} where outcome = 'solved'), ${PACIFIC_TODAY})` : from;
  const [range] = await query(`select ${first}::text as range_from, ${PACIFIC_TODAY}::text as range_to`);

  const entries = rows.filter((row) => Number(row.position) <= TOP).map((row) => toEntry(row, byTime));
  const mine = rows.find((row) => row.id === me?.id && Number(row.position) > TOP);
  return { period, game, from: range.range_from as string, to: range.range_to as string, entries, you: mine ? toEntry(mine, byTime) : null, players: rows.length > 0 ? Number(rows[0].players) : 0 };
}
