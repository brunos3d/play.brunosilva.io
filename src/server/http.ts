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
 * "unavailable", an ApiFailure becomes its status and code, and anything else
 * is a 500 that says nothing about what went wrong inside.
 */
export function handle<Args extends unknown[]>(run: (...args: Args) => Promise<NextResponse>): (...args: Args) => Promise<NextResponse> {
  return async (...args) => {
    if (!isDatabaseConfigured()) return json({ error: "unavailable" }, { status: 503 });
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
