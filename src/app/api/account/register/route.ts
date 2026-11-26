import { registrationOptions, relyingParty, verifyRegistration } from "@/server/accounts";
import { ApiFailure, handle, json, readBody } from "@/server/http";
import { ensurePlayer, requirePlayer } from "@/server/players";

/**
 * Adds a passkey to the current player, in two requests:
 * `{ action: "options" }` returns what the browser hands to the authenticator,
 * and `{ action: "verify", response, label }` stores the answer. A device
 * without a player gets one first, so a brand new visitor can make an account.
 */
export const POST = handle(async (request: Request) => {
  const party = relyingParty(request);
  const body = await readBody(request);
  if (body.action === "options") return json({ options: await registrationOptions(await ensurePlayer(body), party) });
  if (body.action === "verify") return json(await verifyRegistration(await requirePlayer(), party, body.response, body.label));
  throw new ApiFailure(400, "unknown-action");
});
