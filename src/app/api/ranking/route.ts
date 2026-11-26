import { handle, json } from "@/server/http";
import { currentPlayer } from "@/server/players";
import { parseRankingQuery, readRanking } from "@/server/scores";

/** A ranking: `period` is "today", "week", "month" or "all", `game` a game id or "all", `variant` the language for a game with one daily per language. */
export const GET = handle(async (request: Request) => {
  const { period, game, variant } = parseRankingQuery(new URL(request.url).searchParams);
  return json({ ranking: await readRanking(await currentPlayer(), period, game, variant) });
});
