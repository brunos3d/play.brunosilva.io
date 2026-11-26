import { handle, json } from "@/server/http";
import { closeSession } from "@/server/players";

/** Signs this device out. It goes back to the player it had before, if it had one. */
export const POST = handle(async () => {
  await closeSession();
  return json({ ok: true });
});
