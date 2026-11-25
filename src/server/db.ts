import "server-only";
import { type NeonQueryFunction, neon } from "@neondatabase/serverless";

/**
 * The one database of the platform: a Neon Postgres, provisioned through the
 * Vercel Marketplace, which sets DATABASE_URL in every environment. It holds
 * what cannot live on a single device: players, challenge rooms and the
 * scores behind the rankings. Puzzles, progress and streaks stay on the device.
 *
 * Queries go over HTTP (the Neon serverless driver), one round trip each, so a
 * function never holds a connection open.
 *
 * Every table lives in one Postgres schema, "play" by default. PLAY_DB_SCHEMA
 * names another one: the browser tests use "play_e2e", so they never write
 * next to real players.
 */
export const DB_SCHEMA = process.env.PLAY_DB_SCHEMA?.trim() || "play";
if (!/^[a-z][a-z0-9_]{0,30}$/.test(DB_SCHEMA)) throw new Error(`Invalid PLAY_DB_SCHEMA: ${DB_SCHEMA}`);

/** False when the site runs without a database, as in a fork or a test run with no credentials. Online features then report themselves as unavailable. */
export const isDatabaseConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

let client: NeonQueryFunction<false, false> | null = null;

function connection(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseUnavailable();
  client ??= neon(url);
  return client;
}

export class DatabaseUnavailable extends Error {
  constructor() {
    super("The database is not configured.");
  }
}

/** A table of the platform's schema, quoted: `${t("rooms")}` is "play"."rooms". The schema name is validated above, and table names are literals in the callers. */
export const t = (table: string): string => `"${DB_SCHEMA}"."${table}"`;

export type Row = Record<string, unknown>;

/** Runs one statement with positional parameters and returns its rows. */
export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await connection().query(text, params)) as T[];
}

/** Runs several statements in one transaction and one round trip. Returns the rows of each. */
export async function transaction(statements: readonly { text: string; params?: unknown[] }[]): Promise<Row[][]> {
  const sql = connection();
  return (await sql.transaction(statements.map((statement) => sql.query(statement.text, statement.params ?? [])))) as Row[][];
}
