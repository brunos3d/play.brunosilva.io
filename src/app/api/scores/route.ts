import { ApiFailure, handle, json, readBody } from "@/server/http";
import { ensurePlayer } from "@/server/players";
import { submitScore } from "@/server/scores";
import { parseScore } from "@/shared/online/scores";

/** A finished daily puzzle. The first one of a game, language and date counts. A device without a player gets one here, but only for a submission that makes sense. */
export const POST = handle(async (request: Request) => {
  const body = await readBody(request);
  if (!parseScore(body)) throw new ApiFailure(400, "invalid-score");
  return json(await submitScore(await ensurePlayer(body), body));
});
