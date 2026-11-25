/**
 * npm run db:migrate
 *
 * Creates or updates the tables in the schema named by PLAY_DB_SCHEMA ("play"
 * when unset). It reads DATABASE_URL from the environment, or from .env.local,
 * which `vercel env pull` writes. Safe to run again: every statement is
 * idempotent (see src/server/schema.ts).
 *
 *   npm run db:migrate                          the real tables
 *   PLAY_DB_SCHEMA=play_e2e npm run db:migrate  the tables the browser tests use
 */
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "../../src/server/schema";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (existsSync(".env.local")) {
    const match = /^DATABASE_URL="?([^"\n]+)"?$/m.exec(readFileSync(".env.local", "utf8"));
    if (match) return match[1];
  }
  throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
}

async function main(): Promise<void> {
  const schema = process.env.PLAY_DB_SCHEMA?.trim() || "play";
  const sql = neon(databaseUrl());
  const statements = schemaStatements(schema);
  for (const statement of statements) await sql.query(statement);
  const tables = (await sql.query("select table_name from information_schema.tables where table_schema = $1 order by table_name", [schema])) as { table_name: string }[];
  console.log(`schema "${schema}": ${statements.length} statements applied, tables: ${tables.map((row) => row.table_name).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
