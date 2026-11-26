# Security

A review of the site made on 2026-11-26, with what was found, what was fixed and what is left. It started from one question: can a value typed by a client reach the database as SQL, and let someone create tables or read, change or delete another player's data?

The answer is no. The rest of this page says why, how that was checked, and what else turned up.

## SQL injection

### Why it cannot happen

Every statement the server runs goes through two functions in `src/server/db.ts`: `query(text, params)` and `transaction(statements)`. The text and the values travel apart. The Neon driver posts `{ query, params }` to the database, which plans the text with `$1`, `$2` placeholders and binds the values afterwards. A value is never part of the text, so nothing in it is ever read as SQL. A name of `'; DROP TABLE x; --` is stored as those 19 characters.

The statement text itself is built from template strings, and every `${...}` in them was listed and checked. They are one of four things:

- `t("players")` and the other eight table names, always a string literal in the code. The schema in front of it comes from the environment and is checked against `/^[a-z][a-z0-9_]{0,30}$/`.
- Constants of the file: `PACIFIC_TODAY`, column lists, intervals, the numbers of the points formula.
- A value from a closed list checked in code. The one case is the period of a ranking, which is looked up in a table of four SQL fragments after `RANKING_PERIODS.find(...)`.
- A placeholder number, as in `$${params.length}`.

No request field, cookie, header or path segment is in any of them. Nothing read back from the database is put into statement text either, so a stored value cannot become SQL later.

There is no `LIKE`, no regular expression operator, no `format()` and no `EXECUTE` on user input. One `query()` call runs one statement.

### How it was checked

By reading: an auditor listed every `query()` and `transaction()` call in the repository, every interpolation in each, and every path from a request to a statement. The calls are all in five files of `src/server/` (`accounts.ts`, `players.ts`, `push.ts`, `rooms.ts`, `scores.ts`) and in the migration script, which takes no input.

By attacking: `e2e/platform/security.spec.ts` sends 35 hostile values through every field of every route, about two thousand requests, against the real server and a real Postgres schema. The values are the classic ones: quotes, `' OR '1'='1`, stacked `DROP TABLE` and `CREATE TABLE` statements, `UNION SELECT` of the secret column, `pg_sleep` in three forms, placeholders, comment tricks, NUL bytes, half surrogate pairs and 6,000 characters of padding. It then checks, in the database itself:

- no answer was a server error, and none took as long as an injected sleep;
- a display name that was accepted is stored exactly as the cleaning leaves it, character for character;
- the schema has the same tables and columns as before;
- a bystander's player and score are untouched.

The same file checks that hostile cookies identify nobody, that one player cannot act on another's passkeys, nickname, rooms or account, and that an error answer is one word with nothing about the inside.

### What limits the damage if it ever did

The application connects with the role that owns the database, which can drop tables. That is the default of the Neon integration. A separate role with no more than `select`, `insert`, `update` and `delete` on the application's schema, used by the site while migrations keep the owner role, would turn any future injection from "everything" into "the rows". It is listed under what is left.

## The audit

Six auditors read the code, each with one concern: SQL injection, access control, input handling and denial of service, the client side, sessions and headers, and secrets and configuration. Every finding then went to a second reader whose job was to refute it. 57 findings were raised, 18 were refuted and 39 stood: 3 of medium severity, 21 low and 15 notes. Nothing critical or high.

### Fixed

| Finding | What changed |
| --- | --- |
| The secret of the device an account was made on kept working forever, even after signing out | Making an account gives that device a session, and the secret is retired by the next request that shows the session arrived. Signing out retires it for accounts made before. |
| Sessions never expired and could not be ended from another device | A session ends after 180 days without use, and the hourly job deletes it. An account keeps at most 20. "Sign out on other devices" on the profile page ends every one but the session of the device asking. |
| Signing out deleted a session by its id alone | It now takes the secret too. |
| Passkey registration stored client data of any size | Transports are kept only from the seven WebAuthn names, the credential id and key have size limits, and the limit of ten passkeys is checked where the row is written, with the player's row locked. |
| A request body of any size was parsed | Bodies over 64 KB are refused with 413. |
| The limit of 12 players in a room could be passed by joins arriving together | The room's row is locked before the count. |
| Deleting a player erased rooms other people were in | A room with other players goes to the one who has been there longest. |
| A new player failed with a 500 when two nickname candidates were taken | Up to five attempts, each with a longer random tail. |
| Display names accepted invisible and reordering characters | They are stripped by Unicode category. |
| A board with a NUL character made the server answer 500 | Such a board is refused. Found by the test, not by reading. |
| An address with invalid percent-encoding made the framework answer 500 | The proxy answers 400. Found by the test. |
| The site could be shown inside a frame by any page, and sent no security headers | `frame-ancestors 'none'`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security` on every answer (`next.config.ts`). |
| Any address under `/rooms/` became a page stored on the server | The room page is rendered per request, never stored, and only for something that can be a room code. |
| `.vercelignore` did not cover what `.gitignore` covers | It does now. A deploy from the command line no longer uploads test output or a stray `.env` file. |
| Known vulnerabilities in dependencies | Next.js went from 16.1.6 to 16.4.6. `npm audit` reports none. |

Two earlier changes closed things the audit confirmed as already safe: writes that a page of another site sets off are refused (`isCrossSiteWrite`), and a made-up language no longer gives a second scored puzzle for the same day.

### Streak reminders

Reminders were written during the review and audited with the rest. The server posts to an address a client gives it, which is the classic way to make a server call something it should not. The address has to be `https`, on the default port, at the push service of Google, Mozilla, Microsoft or Apple, and what is stored is the address as the parser wrote it. A subscription that exists is only changed or removed by a request that presents its keys. The scheduled route answers only to the project's `CRON_SECRET`.

Two more reviews followed, of the reminders and of the fixes above, before anything shipped. The first confirmed 31 findings and the second 15, two of them of medium severity: a reminder at a fixed 19:00 reached players in Asia and Oceania after their day had already turned, and signing out the other devices deleted the asking device's own session before it had a new one. All 46 are fixed. The others worth naming: a device that signed out kept getting the account's reminders, and a secret token of the right length in the wrong alphabet made the scheduled route answer 500 instead of 401.

## What is left

In order of value.

**Rate limiting.** A request without a cookie creates a player, and nothing limits how many. That is storage, and it is how a script floods a ranking with made-up players. The site stores no addresses, by choice, so the limit belongs at the edge: a Vercel Firewall rule on `POST`, `PATCH` and `DELETE` under `/api/`, keyed by address, around 60 a minute. `GET` stays out of it, since a room is polled every second or two. No code is needed.

**A database role with less power.** See above.

**One database for every environment.** Production, previews and a local `next dev` share one database and one schema, because the Marketplace connects one resource to all of them. A compromised preview or laptop reaches production data. A Neon branch for previews and development fixes it.

**`__Host-` cookies.** The two cookies are `HttpOnly`, `Secure` in production and `SameSite=Lax`, with no `Domain`. The prefix would also stop another `brunosilva.io` subdomain from planting one. Renaming a cookie signs everyone out unless both names are read for a while, so it was left for a quiet moment.

**A script rule in the Content Security Policy.** The pages carry inline scripts, the theme's and the framework's, so a useful `script-src` needs a nonce per request, and the pages would stop being static. No user-controlled value is rendered as HTML anywhere: React escapes text, the one `dangerouslySetInnerHTML` is a constant, and avatars are drawn from a seed limited to letters, digits and dashes.

**Players nobody uses.** A player with no score, room, passkey or reminder stays in the table. A sweep after a few months would keep it small.

Known and accepted, as `docs/ONLINE.md` explains: the client reports its own solve times, puzzles are generated in the browser, and a passkey works without a fingerprint or PIN on an authenticator that cannot ask for one.

## Rules for new code

- A value from a request goes in `params`. Never in the statement text, whatever checks it passed.
- An interpolation in statement text is a literal, a constant, or a pick from a list written in the code.
- Who the request acts as comes from `currentPlayer()`. An id in a body or a path names a thing, never the actor, and every statement that touches a player's rows has that player's id in its `where`.
- A new text field gets a length, an alphabet where it has one, and a line in `e2e/platform/security.spec.ts`.
- A URL the server will call is checked against a list of hosts.
- A new cookie, table or provider changes the privacy policy in the same commit.
