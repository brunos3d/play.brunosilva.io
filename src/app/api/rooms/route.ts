import { handle, json, readBody } from "@/server/http";
import { ensurePlayer } from "@/server/players";
import { createRoom, requireCode } from "@/server/rooms";

/**
 * Opens a challenge room. The body holds the rounds and, for a rematch, the
 * code of the room it follows. The player who asks becomes the host.
 */
export const POST = handle(async (request: Request) => {
  const body = await readBody(request);
  const host = await ensurePlayer(body);
  const rematchOf = typeof body.rematchOf === "string" ? requireCode(body.rematchOf) : null;
  return json({ room: await createRoom(host, body.rounds, rematchOf) }, { status: 201 });
});
