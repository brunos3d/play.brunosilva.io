# Online features

Most of the site needs no server. Puzzles are generated in the browser, and progress, streaks and best times live on the device. Three things cannot work that way, and they share one database:

- players: who a device is, with a name and an avatar;
- challenge rooms, described in [MULTIPLAYER.md](MULTIPLAYER.md);
- the ranking of the daily puzzles.

## Database

A [Neon](https://neon.tech) Postgres on the free plan, provisioned through the Vercel Marketplace:

```
vercel integration add neon --name play-db --billing-plan free_v3 --meta region=iad1 --meta auth=false --meta realtime=false
```

That resource is `play-db`, connected to the `play` project in every environment. Vercel sets `DATABASE_URL` and the other `PG*` variables. `vercel env pull .env.local` brings them to a local checkout.

Queries go through the Neon serverless driver over HTTP (`src/server/db.ts`): one round trip per statement or per transaction, and no connection kept open by a function.

### Schemas

Every table lives in one Postgres schema, named by `PLAY_DB_SCHEMA`:

| Schema | Used by |
| --- | --- |
| `play` (default) | production, previews and local development |
| `play_e2e` | the browser tests |

Production, previews and a local `next dev` share the `play` schema, because the Marketplace connects one database to all environments. Keep that in mind before testing by hand against it. To work apart from real players, set `PLAY_DB_SCHEMA` to a schema of your own.

### Tables

Defined in `src/server/schema.ts` as a list of idempotent statements.

| Table | Holds |
| --- | --- |
| `players` | `id`, the hash of the device's secret, `name`, `avatar` (a seed), and the streak in the ranking |
| `rooms`, `room_players` | Challenge rooms and the players in them |
| `daily_scores` | The first solved daily puzzle of a player per game, language and date, with its points |

### Migrations

```
npm run db:migrate                          # the "play" schema
PLAY_DB_SCHEMA=play_e2e npm run db:migrate  # the schema the browser tests use
```

The script runs every statement of `schemaStatements`. All of them are `create ... if not exists`, so running it again is safe. A change to a table is a new statement at the end of the list (`alter table ... add column if not exists`), never an edit of an old one.

Migrations are not part of the build. Run `npm run db:migrate` before deploying code that needs a new column.

### Without a database

When `DATABASE_URL` is not set, every route under `/api` answers `503 { "error": "unavailable" }`. The home screen then leaves out the ranking card, the room and ranking pages say the feature is off, and scores are not sent. Everything else works as before. A fork of the repository runs this way with no setup.

## Players

There are no accounts. A player is a device.

The first time a device needs an identity (it joins or opens a room, or solves a daily puzzle), the server creates a player and sets a cookie:

```
play_player=<player id>.<random secret>; HttpOnly; SameSite=Lax; Secure; Max-Age=2 years
```

- The database stores a SHA-256 hash of the secret, never the secret. Reading the table does not let anyone act as a player.
- The cookie is `HttpOnly`, so scripts on the page cannot read it. The only way to copy an identity is from the device itself, with its developer tools.
- Clearing the browser's data ends the identity. The player then starts over as a new one.

A new player gets a generated name, an animal and a number in the language of the page ("Raposa 412", "Fox 412"), and a random avatar. Both can be changed on the ranking page and when joining a room.

Names are cleaned on the server (`cleanPlayerName`): one line, at most 20 characters, no control characters and no characters that hide or reorder text. There is no word filter. Names are visible to everyone in a ranking, so a filter or a report button is the first thing to add if the site gets an audience that needs one.

### Avatars

Avatars are drawn in the browser by [DiceBear](https://www.dicebear.com), in its "Thumbs" style, from the avatar seed. The library is MIT, and the Thumbs designs are CC0 1.0. The server stores the seed only: no image is uploaded, stored or fetched from another site.

### API

| Request | Does |
| --- | --- |
| `GET /api/session` | The device's player, or `null`. Never creates one. |
| `POST /api/session` `{ name?, avatar?, locale? }` | The device's player, created if missing. |
| `PATCH /api/session` `{ name?, avatar? }` | Changes the name, the avatar, or both. |

## Ranking

Only daily puzzles count. Practice and challenge rooms do not.

When a daily puzzle is solved for the first time, the game frame sends the result to `POST /api/scores`. The answer carries the points, which then show on the result screen with a link to the ranking. A revealed or lost puzzle is not sent.

### Points

```
points = max(20, 100 - 10 * hints) + round(50 * min(1, par / time))
```

100 for solving, minus 10 per hint, plus up to 50 for speed. `par` is 1 minute on easy, 2 on medium, 4 on hard and 6 on expert. Solving within par earns the whole bonus, and twice the par time earns half of it. The rule is in `src/shared/online/scores.ts`.

### What is ranked

| View | Order |
| --- | --- |
| One game, today | Time, lowest first. Everyone solved the same puzzle. A hint counts as 30 seconds. |
| All games today, or any view of the week | Points, summed. |

A week runs from Monday to Sunday on the Pacific calendar, the calendar of the daily puzzles.

Termo and Wend have one daily puzzle per language. Their ranking by time is per language, since the puzzles differ. Their points all go to the same player.

The response holds the top 50, and the asking player's own row when they are below that.

### Streaks

`players.streak_current` counts consecutive days with at least one scored daily puzzle, in any game. It shows as a flame next to a player from two days up. It is separate from the per-game streak on the device, which works offline and stays the source of truth for the result screen.

### API

| Request | Does |
| --- | --- |
| `POST /api/scores` `{ game, variant?, date, number, difficulty, size, elapsedMs, hintsUsed, mistakes }` | Records a solved daily puzzle. Answers `{ points, recorded }`. |
| `GET /api/ranking?period=today\|week&game=all\|<id>&variant=` | A ranking. |

### Trust

The time comes from the player's device, and the server cannot prove it is honest. It only refuses what cannot be true: a date that is not today's puzzle (with a day of slack for time zones), a time under one second or over a day, a second score for the same puzzle. That is enough for a ranking among friends. A real defence would replay the solution on the server, or compare the time with timestamps the server took itself, as challenge rooms do.

## Not built yet

- Accounts with a password or an email, and moving a player to another device. The `players` table is ready for it: an account would be a second way to prove who a player is, next to the device's secret.
- A way to stay out of the ranking, and a way to delete a player.
- Monthly and all-time rankings.
- Rate limits at the edge. The API has per-player limits for rooms only. The Vercel Firewall can cap requests per address without code.
