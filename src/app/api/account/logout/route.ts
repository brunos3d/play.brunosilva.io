import { handle, json, readBody } from "@/server/http";
import { closeEverySession, closeSession, currentPlayer } from "@/server/players";

/**
 * Signs this device out. It goes back to the player it had before, if it had
 * one. With `{ everywhere: true }` every other device of the account is signed
 * out and this one stays as it is: for a phone that was lost.
 */
export const POST = handle(async (request: Request) => {
  const body = await readBody(request);
  const player = body.everywhere === true ? await currentPlayer() : null;
  if (player?.account) await closeEverySession(player);
  else await closeSession();
  return json({ ok: true });
});
