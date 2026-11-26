import { loginOptions, relyingParty, verifyLogin } from "@/server/accounts";
import { ApiFailure, handle, json, readBody } from "@/server/http";

/**
 * Signs in with a passkey, in two requests: `{ action: "options" }` returns
 * the challenge, and `{ action: "verify", response }` checks the signature and
 * opens a session for the passkey's account on this device.
 */
export const POST = handle(async (request: Request) => {
  const party = relyingParty(request);
  const body = await readBody(request);
  if (body.action === "options") return json({ options: await loginOptions(party) });
  if (body.action === "verify") return json(await verifyLogin(party, body.response));
  throw new ApiFailure(400, "unknown-action");
});
