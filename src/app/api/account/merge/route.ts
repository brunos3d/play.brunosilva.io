import { mergeDevice } from "@/server/accounts";
import { handle, json } from "@/server/http";
import { requirePlayer } from "@/server/players";

/** Moves the device's own player, with its scores and rooms, into the account the device is signed in to. */
export const POST = handle(async () => json(await mergeDevice(await requirePlayer())));
