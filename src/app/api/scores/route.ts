import { ApiFailure, handle, json, readBody } from "@/server/http";
import { currentPlayer, ensurePlayer } from "@/server/players";
import { submitScore } from "@/server/scores";
import { parseScore } from "@/shared/online/scores";

/**
 * A closed daily puzzle: solved, revealed or lost. The first close of a game,
 * language and date counts. A solve gives a device without a player one, but
 * only for a submission that makes sense. A reveal or a loss never creates a
 * player: there is nobody yet for whom the day would be closed.
 */
export const POST = handle(async (request: Request) => {
  const body = await readBody(request);
  const score = parseScore(body);
  if (!score) throw new ApiFailure(400, "invalid-score");
  const known = await currentPlayer();
  const player = known ?? (score.revealed ? null : await ensurePlayer(body));
  if (!player) return json({ points: 0, recorded: false, record: null, player: null });
  // A board is kept only for a player the server already knew. A request that creates its own player could otherwise
  // store a board's worth of anything, as often as it liked. The device sends the board again with its next sync.
  if (!known) delete body.board;
  return json(await submitScore(player, body));
});
