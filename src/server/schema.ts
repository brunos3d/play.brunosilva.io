/**
 * The tables, as idempotent statements. `npm run db:migrate` runs them against
 * the schema named by PLAY_DB_SCHEMA ("play" when unset). A change to a table
 * is a new statement at the end (`alter table ... add column if not exists`),
 * never an edit of an old one, so running the list again is always safe.
 *
 * This module has no imports on purpose: the migration script and the tests
 * use it outside Next.js.
 */
export function schemaStatements(schema: string): string[] {
  if (!/^[a-z][a-z0-9_]{0,30}$/.test(schema)) throw new Error(`Invalid schema name: ${schema}`);
  const s = `"${schema}"`;
  return [
    `create schema if not exists ${s}`,

    // A player is a device until proven otherwise: an id and the hash of a secret that only that device's cookie holds.
    `create table if not exists ${s}.players (
      id uuid primary key,
      secret_hash text not null,
      name text not null,
      avatar text not null,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      streak_current integer not null default 0,
      streak_best integer not null default 0,
      streak_date date
    )`,

    // A challenge room. `rounds` is the list of puzzles, fixed when the room is created.
    `create table if not exists ${s}.rooms (
      code text primary key,
      host_id uuid not null references ${s}.players (id),
      status text not null default 'lobby' check (status in ('lobby', 'racing', 'finished')),
      rounds jsonb not null,
      created_at timestamptz not null default now(),
      started_at timestamptz,
      finished_at timestamptz,
      rematch_code text
    )`,
    `create index if not exists rooms_created_at on ${s}.rooms (created_at)`,

    // One row per player in a room. `results` grows by one entry per round played: { at, solved, hints }.
    `create table if not exists ${s}.room_players (
      room_code text not null references ${s}.rooms (code) on delete cascade,
      player_id uuid not null references ${s}.players (id),
      joined_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      started_at timestamptz,
      results jsonb not null default '[]'::jsonb,
      finished_at timestamptz,
      gave_up boolean not null default false,
      primary key (room_code, player_id)
    )`,

    // The first finished daily puzzle of a player, per game, language and date. `variant` is '' for the legacy language.
    `create table if not exists ${s}.daily_scores (
      player_id uuid not null references ${s}.players (id),
      game text not null,
      variant text not null default '',
      date date not null,
      number integer not null,
      difficulty text not null,
      size integer not null,
      elapsed_ms integer not null,
      hints integer not null,
      mistakes integer not null,
      points integer not null,
      created_at timestamptz not null default now(),
      primary key (player_id, game, variant, date)
    )`,
    `create index if not exists daily_scores_date_game on ${s}.daily_scores (date, game)`,
  ];
}
