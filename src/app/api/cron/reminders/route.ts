import { createHash, timingSafeEqual } from "node:crypto";
import { handle, json } from "@/server/http";
import { sendReminders } from "@/server/push";

/**
 * Sends the streak reminders that are due. Vercel calls it once an hour
 * (vercel.json) with the project's CRON_SECRET as a bearer token, and nobody
 * else can: without the secret in the environment the route refuses everyone.
 */
/** A run sends for a minute and a half at most (see RUN_BUDGET_MS in server/push.ts), then answers. */
export const maxDuration = 120;

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

export const GET = handle(async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  // Hashes are compared, so the two sides always have the same length whatever was sent.
  const allowed = Boolean(secret) && timingSafeEqual(digest(given), digest(`Bearer ${secret ?? ""}`));
  if (!allowed) return json({ error: "unauthorized" }, { status: 401 });
  // A run that only marks who was due (PUSH_DRY_RUN, which is how the tests run it) can be told what time to pretend it
  // is. A run that sends always uses the clock.
  const at = process.env.PUSH_DRY_RUN === "1" ? Date.parse(new URL(request.url).searchParams.get("at") ?? "") : Number.NaN;
  return json(await sendReminders(Number.isNaN(at) ? new Date() : new Date(at)));
});
