import { deletePlayer, readAccount } from "@/server/accounts";
import { handle, json } from "@/server/http";
import { requirePlayer } from "@/server/players";

/** The device's player, the passkeys of its account, and the device player that could join the account. Reading never creates anything. */
export const GET = handle(async () => json(await readAccount()));

/** Deletes the current player and everything stored about them. */
export const DELETE = handle(async () => {
  await deletePlayer(await requirePlayer());
  return json({ ok: true });
});
