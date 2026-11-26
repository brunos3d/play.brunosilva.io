import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "../src/server/schema";

const SCHEMA = "play_e2e";

function databaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env.local")) return null;
  return /^DATABASE_URL="?([^"\n]+)"?$/m.exec(readFileSync(".env.local", "utf8"))?.[1] ?? null;
}

/**
 * The online features (rooms, rankings) are tested against a real database, in
 * a schema that only the tests use. This creates its tables if they are
 * missing and empties them. Without a database the online tests skip
 * themselves, and everything else runs as usual.
 */
export default async function globalSetup(): Promise<void> {
  const url = databaseUrl();
  if (!url) return;
  const sql = neon(url);
  for (const statement of schemaStatements(SCHEMA)) await sql.query(statement);
  await sql.query(`truncate "${SCHEMA}".daily_scores, "${SCHEMA}".daily_opens, "${SCHEMA}".push_subscriptions, "${SCHEMA}".room_players, "${SCHEMA}".rooms, "${SCHEMA}".passkeys, "${SCHEMA}".sessions, "${SCHEMA}".challenges, "${SCHEMA}".players`);
}
