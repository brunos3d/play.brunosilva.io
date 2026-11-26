import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

/**
 * Direct access to the test schema, for the few things a test cannot set up
 * through the site: a streak that started yesterday, a row to look at. The
 * site itself is always tested through its pages and its API.
 */
export const SCHEMA = "play_e2e";

function databaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env.local")) return null;
  return /^DATABASE_URL="?([^"\n]+)"?$/m.exec(readFileSync(".env.local", "utf8"))?.[1] ?? null;
}

/** Runs one statement against the test schema. `{schema}` in the text is replaced by its quoted name. */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const url = databaseUrl();
  if (!url) throw new Error("No database: set DATABASE_URL or run `vercel env pull .env.local`.");
  return (await neon(url).query(text.replaceAll("{schema}", `"${SCHEMA}"`), params)) as T[];
}
