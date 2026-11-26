import "server-only";
import { GAME_IDS, type GameId } from "@/games/registry";
import { RANKING_HINT_MS, parseScore, scorePoints } from "@/shared/online/scores";
import { type Me, RANKING_PERIODS, type Ranking, type RankingEntry, type RankingPeriod } from "@/shared/online/types";
import { type Row, query, t } from "./db";
import { ApiFailure } from "./http";

/**
 * Daily scores and the rankings built from them. A player's first finished
 * daily puzzle of a game, language and date is the one that counts, as on the
 * device. Dates are Pacific calendar dates, the calendar of the daily puzzles.
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

/** Records a finished daily puzzle and moves the player's streak. `recorded` is false when this puzzle already had a score, or is not today's. */
export async function submitScore(player: Me, body: Record<string, unknown>): Promise<{ points: number; recorded: boolean }> {
  const score = parseScore(body);
  if (!score) throw new ApiFailure(400, "invalid-score");
  const points = scorePoints(score.difficulty, score.elapsedMs, score.hintsUsed);

  // Only today's puzzle scores, with a day of slack: the player's device decides its own "today", and a puzzle opened before midnight Pacific may end after it.
  const [inserted] = await query(
    `insert into ${t("daily_scores")} (player_id, game, variant, date, number, difficulty, size, elapsed_ms, hints, mistakes, points)
     select $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11
     where $4::date between ${PACIFIC_TODAY} - 1 and ${PACIFIC_TODAY}
     on conflict (player_id, game, variant, date) do nothing
     returning date`,
    [player.id, score.game, score.variant ?? "", score.date, score.number, score.difficulty, score.size, score.elapsedMs, score.hintsUsed, score.mistakes, points],
  );
  if (!inserted) return { points, recorded: false };

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
  return { points, recorded: true };
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
  const filters = [`s.date between ${from} and ${PACIFIC_TODAY}`];
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
  const first = period === "all" ? `coalesce((select min(date) from ${t("daily_scores")}), ${PACIFIC_TODAY})` : from;
  const [range] = await query(`select ${first}::text as range_from, ${PACIFIC_TODAY}::text as range_to`);

  const entries = rows.filter((row) => Number(row.position) <= TOP).map((row) => toEntry(row, byTime));
  const mine = rows.find((row) => row.id === me?.id && Number(row.position) > TOP);
  return { period, game, from: range.range_from as string, to: range.range_to as string, entries, you: mine ? toEntry(mine, byTime) : null, players: rows.length > 0 ? Number(rows[0].players) : 0 };
}
