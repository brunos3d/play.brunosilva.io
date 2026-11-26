import "server-only";
import { NextResponse } from "next/server";
import { DatabaseUnavailable, isDatabaseConfigured } from "./db";

/** An error a client can act on: an HTTP status and a short code the interface maps to a message. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * True for a request that changes something and was sent by a page of another
 * site. The cookies are SameSite=Lax, so such a request arrives without them,
 * and that is the danger: the server would take the visitor for a new one and
 * answer with a new player's cookie, replacing the one their device had.
 *
 * Browsers say where a request comes from in Sec-Fetch-Site, and in Origin on
 * anything that is not a plain GET. A request with neither is not from a page
 * at all (a script, a test), and has no visitor's cookies to lose.
 */
export function isCrossSiteWrite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export const json = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse => NextResponse.json(body, { status: init.status ?? 200, headers: { ...NO_STORE, ...init.headers } });

/** Reads a JSON body. Anything that is not an object comes back as an empty one, and the handler's own checks refuse it. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Wraps a route handler: a site without a database answers 503 with
 * "unavailable", a write that another site's page set off is refused, an
 * ApiFailure becomes its status and code, and anything else is a 500 that
 * says nothing about what went wrong inside.
 */
export function handle<Args extends unknown[]>(run: (...args: Args) => Promise<NextResponse>): (...args: Args) => Promise<NextResponse> {
  return async (...args) => {
    if (!isDatabaseConfigured()) return json({ error: "unavailable" }, { status: 503 });
    if (args[0] instanceof Request && isCrossSiteWrite(args[0])) return json({ error: "cross-site" }, { status: 403 });
    try {
      return await run(...args);
    } catch (error) {
      if (error instanceof ApiFailure) return json({ error: error.code }, { status: error.status });
      if (error instanceof DatabaseUnavailable) return json({ error: "unavailable" }, { status: 503 });
      console.error(error);
      return json({ error: "server" }, { status: 500 });
    }
  };
}
