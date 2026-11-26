import { ApiFailure, handle, json, readBody } from "@/server/http";
import { currentPlayer, requirePlayer } from "@/server/players";
import { isSubscribed, pushPublicKey, subscribe, unsubscribe } from "@/server/push";
import { parseSubscription } from "@/shared/online/push";

/**
 * Reminders of a streak about to end, for the device asking.
 *
 * GET answers the key a browser needs to subscribe, or null when reminders
 * are not set up here.
 */
export const GET = handle(async () => json({ key: pushPublicKey() }));

/**
 * `{ subscription, locale, timezone }` subscribes this device for the current
 * player. A device asks again when its language changes.
 *
 * `{ action: "status", endpoint }` says whether that endpoint is subscribed
 * for the current player. It is a POST so the endpoint travels in the body: it
 * is the address a message is sent to, and has no place in a URL that ends up
 * in logs.
 */
export const POST = handle(async (request: Request) => {
  const body = await readBody(request);
  if (body.action === "status") {
    const player = await currentPlayer();
    return json({ key: pushPublicKey(), subscribed: player ? await isSubscribed(player, body.endpoint) : false });
  }
  if (!pushPublicKey()) throw new ApiFailure(503, "push-unavailable");
  const input = parseSubscription(body);
  if (!input) throw new ApiFailure(400, "invalid-subscription");
  await subscribe(await requirePlayer(), input);
  return json({ ok: true });
});

/** Stops the reminders of a device: `{ endpoint, auth }`, the two things only that device has. */
export const DELETE = handle(async (request: Request) => {
  const body = await readBody(request);
  await unsubscribe(body.endpoint, body.auth);
  return json({ ok: true });
});
