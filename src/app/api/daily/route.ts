import { isDatabaseConfigured } from "@/server/db";
import { handle, json, readBody } from "@/server/http";
import { currentPlayer } from "@/server/players";
import { openDaily, readDaily } from "@/server/scores";
import { pacificDateKey } from "@/shared/engine/pacific-time";

const read = handle(async () => json(await readDaily(await currentPlayer())));

/**
 * How the player's dailies stand on the server: every close, and the puzzles
 * of today and yesterday that are open. A device reads it when a page loads
 * and brings its own storage in line, so a daily closed on a phone is closed
 * on the computer too. A device without a player gets empty lists.
 *
 * Every daily page asks, so a site without a database says so in a normal
 * answer instead of an error: the page then stops asking.
 */
export async function GET() {
  if (!isDatabaseConfigured()) return json({ player: null, today: pacificDateKey(new Date()), records: [], opens: [], unavailable: true });
  return read();
}

/**
 * Notes that a daily is open on this device: `{ game, variant?, date, hints }`.
 * The first call starts the server's clock for it. Never creates a player: a
 * device without one is simply not answered with a time.
 */
export const POST = handle(async (request: Request) => {
  const player = await currentPlayer();
  const body = await readBody(request);
  return json(player ? await openDaily(player, body) : { openedAgoMs: null });
});
