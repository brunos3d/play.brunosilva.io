import { removePasskey } from "@/server/accounts";
import { handle, json } from "@/server/http";
import { requirePlayer } from "@/server/players";

type Context = { params: Promise<{ id: string }> };

/** Removes one passkey of the account. The last one cannot be removed. */
export const DELETE = handle(async (_request: Request, { params }: Context) => json(await removePasskey(await requirePlayer(), (await params).id)));
