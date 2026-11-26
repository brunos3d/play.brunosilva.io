import { handle, json, readBody } from "@/server/http";
import { currentPlayer, ensurePlayer, updatePlayer } from "@/server/players";

/** Who the device is: the player its cookie belongs to, or null for a device that has none yet. Reading never creates one. */
export const GET = handle(async () => json({ player: await currentPlayer() }));

/** Makes sure the device has a player, creating one when it does not. The body may suggest a name, an avatar seed and the page's locale. */
export const POST = handle(async (request: Request) => json({ player: await ensurePlayer(await readBody(request)) }));

/** Changes the player's name, nickname, avatar, or any of them. A nickname someone else has is a 409 "nickname-taken". */
export const PATCH = handle(async (request: Request) => {
  const body = await readBody(request);
  const player = await ensurePlayer(body);
  return json({ player: await updatePlayer(player, { name: body.name, nickname: body.nickname, avatar: body.avatar }) });
});
