import { ApiFailure, handle, json, readBody } from "@/server/http";
import { currentPlayer, ensurePlayer, requirePlayer } from "@/server/players";
import { joinRoom, leaveRoom, readRoom, recordProgress, requireCode, startRoom } from "@/server/rooms";

type Context = { params: Promise<{ code: string }> };

/**
 * The room as it is now. Every page that shows a room asks for it every second
 * or two, which is also how the server knows a player is still there. Anyone
 * with the code may look, joined or not: that is what the invitation shows.
 */
export const GET = handle(async (_request: Request, { params }: Context) => {
  const code = requireCode((await params).code);
  const player = await currentPlayer();
  return json({ room: await readRoom(code, player?.id ?? null) });
});

/**
 * Everything a player does to a room, by `action`:
 * "join", "leave", "start" (host only) and "progress" (see RoomProgress).
 */
export const POST = handle(async (request: Request, { params }: Context) => {
  const code = requireCode((await params).code);
  const body = await readBody(request);
  switch (body.action) {
    case "join":
      return json({ room: await joinRoom(code, await ensurePlayer(body)) });
    case "leave":
      await leaveRoom(code, await requirePlayer());
      return json({ ok: true });
    case "start":
      return json({ room: await startRoom(code, await requirePlayer()) });
    case "progress":
      return json({ room: await recordProgress(code, await requirePlayer(), body) });
    default:
      throw new ApiFailure(400, "unknown-action");
  }
});
