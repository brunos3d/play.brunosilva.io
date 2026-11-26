# Online features

Most of the site needs no server. Puzzles are generated in the browser, and progress, streaks and best times live on the device. Three things cannot work that way, and they share one database:

- players: who a device is, with a display name, a nickname and an avatar, and the passkeys that let a player sign in from another device;
- challenge rooms, described in [MULTIPLAYER.md](MULTIPLAYER.md);
- the ranking of the daily puzzles.

The notice a first visit gets, the privacy policy and the terms of use are described at the end of this page.

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
| `players` | `id`, the hash of the device's secret, `name`, `nickname` (unique without regard to case), `avatar` (a seed), and the streak in the ranking |
| `passkeys` | The public key of each passkey of an account, its counter, transports, whether it is synced, a label and two dates |
| `sessions` | One row per device signed in to an account: an id and the hash of a secret |
| `challenges` | The value a passkey has to sign, kept between the two requests of a ceremony and used once |
| `push_subscriptions` | One row per device that asked for streak reminders: its push endpoint and keys, language, time zone and the date of the last reminder |
| `rooms`, `room_players` | Challenge rooms and the players in them |
| `daily_scores` | The first close of a daily per player, game, language and date: the outcome (`solved`, `revealed` or `failed`), time, hints, mistakes, moves, the points of a solve, and the finished board for two days |
| `daily_opens` | The first open of a daily per player, by the server's clock, and the highest count of hints. Kept for two days |

### Migrations

```
npm run db:migrate                          # the "play" schema
PLAY_DB_SCHEMA=play_e2e npm run db:migrate  # the schema the browser tests use
```

The script runs every statement of `schemaStatements`. Each one creates what is missing (`create ... if not exists`), or fills in rows that lack a value and leaves the rest alone, so running it again is safe. A change to a table is a new statement at the end of the list (`alter table ... add column if not exists`), never an edit of an old one.

Migrations are not part of the build. Run `npm run db:migrate` before deploying code that needs a new column or table. The statements only add, so the code already in production keeps working while the new one is on its way.

### Without a database

When `DATABASE_URL` is not set, every route under `/api` answers `503 { "error": "unavailable" }`. The one exception is `GET /api/daily`, which every daily page asks: it answers `200` with empty lists and `unavailable: true`, and the page stops asking. The home screen then leaves out the ranking card, the room and ranking pages say the feature is off, and scores are not sent. Everything else works as before. A fork of the repository runs this way with no setup.

## Players

A player starts as a device, with no account. A passkey turns the player into an account that other devices can sign in to (see Accounts below). Nobody is ever asked for an email address or a password.

The first time a device needs an identity (it joins or opens a room, solves a daily puzzle, saves its profile, or turns on reminders), the server creates a player and sets a cookie:

```
play_player=<player id>.<random secret>; HttpOnly; SameSite=Lax; Secure; Max-Age=2 years
```

- The database stores a SHA-256 hash of the secret, never the secret. Reading the table does not let anyone act as a player.
- The cookie is `HttpOnly`, so scripts on the page cannot read it. The only way to copy an identity is from the device itself, with its developer tools.
- Clearing the browser's data ends the identity. The player then starts over as a new one.

A new player gets a generated name, an animal and a number in the language of the page ("Raposa 412", "Fox 412"), a nickname made from it ("raposa412") and a random avatar. All three can be changed on the profile page (`/profile`), and the name and the avatar also when joining a room.

### Display name and nickname

The display name is free text, and two players may pick the same one. It is cleaned on the server (`cleanPlayerName`): one line, at most 20 characters, no control characters and no characters that hide or reorder text. There is no word filter. Names are visible to everyone in a ranking, so a filter or a report button is the first thing to add if the site gets an audience that needs one.

The nickname is the part of a player nobody else can have, so one player cannot pass for another. It is 3 to 20 lower case letters, digits or underscores (`cleanNickname`), which leaves no room for two nicknames that look alike while being different. A few are reserved (`admin`, `minigames` and the like). It shows as `@nickname` under the name in rankings and rooms.

Uniqueness is decided by the database: the update that sets a nickname only applies while no other player holds it, and a unique index on `lower(nickname)` backs that up when two requests arrive together. The answer to a taken nickname is `409 nickname-taken`. A nickname is not reserved after its player changes it or is deleted.

Players from before nicknames existed got one from the migration: their name without accents and spaces, with four characters of their id added when the plain one was taken.

### Avatars

Avatars are drawn in the browser by [DiceBear](https://www.dicebear.com), in its "Thumbs" style, from the avatar seed. The library is MIT, and the Thumbs designs are CC0 1.0. The server stores the seed only: no image is uploaded, stored or fetched from another site.

### API

| Request | Does |
| --- | --- |
| `GET /api/session` | The device's player, or `null`. Never creates one. |
| `POST /api/session` `{ name?, avatar?, locale? }` | The device's player, created if missing. |
| `PATCH /api/session` `{ name?, nickname?, avatar? }` | Changes the name, the nickname, the avatar, or any of them. |

## Accounts

An account is a player with a passkey. The profile page offers it to a device player: "Create account" makes a passkey for the player the device already has, so the name, the scores and the streak carry over as they are. On another device, "Sign in with a passkey" signs in to that same player.

A passkey is a key pair made by the player's password manager, phone or security key. The private half stays there. The server stores the public half and checks signatures (`src/server/accounts.ts`, with [SimpleWebAuthn](https://simplewebauthn.dev)).

### Which authenticators work

Any that speaks WebAuthn: Google Password Manager, iCloud Keychain, Windows Hello, 1Password and other managers, a phone scanned through a QR code from a computer, and FIDO2 security keys such as a YubiKey. The options ask for no attachment and no attestation, so the browser offers everything it has.

Two choices follow from signing in with nothing typed. Registration requires a discoverable credential (`residentKey: "required"`), because the authenticator itself has to say which account it holds. A security key without that feature is refused when the passkey is created, not later when it is needed. User verification is `preferred`: a key that can ask for a fingerprint or a PIN does, and one that cannot still works.

### Relying party

A passkey is bound to a domain, and the browser refuses to use it anywhere else. `relyingPartyFor` (`src/shared/online/relying-party.ts`) names it for each request: the request's `Origin` and `Host` must match, and the host must be `play.brunosilva.io`, a `*.vercel.app` deployment or `localhost`. So a passkey made on a preview deployment stays there, and production has its own.

### Sessions

Signing in creates a row in `sessions` and a second cookie, built like the device's:

```
play_session=<session id>.<random secret>; HttpOnly; SameSite=Lax; Secure; Max-Age=2 years
```

`currentPlayer` reads the session first and the device cookie second. The device cookie stays where it is while a session is open, so signing out gives the device back the player it had.

The device an account is made on is the exception. Until that moment it reached the player with its device cookie. Creating the passkey opens a session for it. The next request that carries both cookies proves the session arrived, and `currentPlayer` then sets the player's `secret_hash` to an empty string (no secret hashes to that) and drops the device cookie. From then on every device of an account holds a session, and a session can be ended. An account made before this rule keeps a working device secret until that device signs out, which retires it.

A session ends after 180 days without use. Reading one moves its `last_seen_at`, at most once a day. The hourly job deletes the expired ones, and opening a session keeps the 20 most recently used of the account.

"Sign out on other devices" on the profile page deletes every session of the account but the one asking, and retires the device secret, in one transaction. A lost phone is out, and the player is not: the session of the device asking is never touched, so the button cannot lock out someone whose only other passkey was on that phone.

### Bringing a device's scores along

A device that signs in may already have a player of its own, with scores. That player is offered to the account on the profile page and joins it only when the person asks: signing in on a friend's computer must not take their points. A device player with no scores and no rooms is not offered at all.

`mergeDevice` runs as one transaction:

- Closed dailies move to the account. Where both closed the same daily puzzle, the earlier close stays, whichever way it ended, as on one device, where only the first one counts. A reveal on one is not undone by a later solve on the other.
- A close that moves is held to the account's own first open of that puzzle and to its hints, when it has them, and scored again if that changes it. Thinking on the account and solving fast on a spare device player does not buy a better time.
- Dailies either of them has open keep the earlier start and the higher count of hints.
- The account takes the device player's place in rooms, unless it is already in the same room.
- The streak is counted again from the days the merged scores cover.
- The device player is deleted, and its cookie with it.

Only a player without passkeys can be merged. Two accounts are never merged.

A board that is still being played lives on its device and is not copied, and neither are best times. An account carries the player: name, nickname, avatar, streak in the ranking, rooms, and every daily the player has closed, with its finished board (see "A daily counts once per player" below).

### Deleting

"Delete my player and my data" on the profile page removes the player, its scores, its place in rooms, its passkeys, its sessions and its reminders, in one transaction. A room it opened goes with it only when nobody else is in it. Otherwise the player who has been there longest becomes the host. It works for a device player too. Nothing is kept.

### API

Every request is same-origin, with the cookies above.

| Request | Does |
| --- | --- |
| `GET /api/account` | `{ player, passkeys, device }`: the player, the passkeys of its account, and a device player that could join the account. |
| `POST /api/account/register` `{ action: "options" }` | What the browser hands to the authenticator to make a passkey. Creates the player if the device has none. |
| `POST /api/account/register` `{ action: "verify", response, label }` | Stores the new passkey. |
| `POST /api/account/login` `{ action: "options" }` | The challenge for signing in. |
| `POST /api/account/login` `{ action: "verify", response }` | Checks the signature and opens a session. |
| `POST /api/account/logout` `{ everywhere? }` | Ends the session. With `everywhere: true`, every other session of the account, and this device stays signed in. |
| `POST /api/account/merge` | Moves the device's own player into the account. |
| `DELETE /api/account/passkeys/:id` | Removes a passkey. The last one cannot be removed. |
| `DELETE /api/account` | Deletes the player and everything stored about it. |

### What it does not do

There is no recovery. With no email and no password, an account whose every passkey and signed-in device is lost cannot be reached again. The page suggests a second passkey for that reason, and an account holds up to ten.

## Ranking

Only daily puzzles count. Practice and challenge rooms do not.

When a daily puzzle ends, the game frame sends the result to `POST /api/scores`. For a solve, the answer carries the points, which then show on the result screen with a link to the ranking. A revealed or lost puzzle is sent too, for a device that has a player: it earns nothing, and it closes the day.

## A daily counts once per player

Progress lives on each device, so a second device of the same player knows nothing of the first. Without more, a player who solved the dailies on their phone would be offered them again on their computer. They could not score twice, since the server keeps one row per player, game, language and date. But they could reveal a puzzle on one device and solve it on the other, or think on one and finish on the other.

Three things close that.

**The server records every close.** A row of `daily_scores` is a closed daily: `outcome` is `solved`, `revealed` or `failed`. The first close wins, whatever it is and wherever it happens, and only a solved one has points and moves the streak. A reveal is reported 0.6 seconds after the board locks, not when the solution has finished playing, so closing the tab halfway closes the day all the same. The wait tells a reveal from a hint that solved the puzzle with its last step. A tab closed inside it reports nothing. Rankings count solved rows only.

**The device follows the server.** `src/shared/online/daily-sync.ts` runs when a page loads. It reads `GET /api/daily`, and for every close of the player writes the result the hub shows and, for today and yesterday, the finished board the game page opens. The server's record replaces a local result that disagrees. The daily page waits for this before it builds the board (`DailyGate` in `src/shared/ui/daily-gate.tsx`), because the games read their storage once, when they mount. The wait is at most 2.5 seconds: a sync that does not answer lets the game through, and the server refuses the second close whatever the device showed.

A daily closed elsewhere with no board on the server (the tab was closed during a reveal, or the close is older than boards) has nothing to show and nothing to play. The page says how it went and offers practice.

**The clock and the hints are the server's.** The frame tells the server when a daily is open and after every hint (`POST /api/daily`). `daily_opens` keeps the first open, by the server's clock, and the highest count of hints. A submission is stored with at least the time since that open, when it is more than 5 seconds over what the device claims, and with at least those hints. The other device also starts its own clock from the first open (`ClockStartContext`), so what the player sees is what will count. Each open, by anyone, sweeps away what is past use for everyone: rows of `daily_opens` older than yesterday, and the boards of closes older than yesterday. A board is only kept for a player the server already knew when the close arrived: a request that creates its own player could otherwise store a board's worth of anything. The device sends the board again as soon as the answer names its new player, and with its next sync if that fails. A board for yesterday's close is still taken when the close itself would be too late.

The cost is a close made offline: sent later, it is timed from the open the server saw, not from the device's clock. A close that could not be sent is kept in an outbox and goes with the next sync of the same player, as long as its puzzle can still be played.

### A device is not a player

Someone signs out, or another person signs in. The sync keeps a ledger of the results and boards the server confirmed for the current player. When the player on the device changes, those are removed, and the next sync writes the new player's. What the device recorded by itself and no server ever confirmed stays.

### What it does not close

A puzzle is generated in the browser from its date, so anyone can see today's solution as a guest in a private window and then solve it as themselves. No server check stops that short of generating puzzles on the server. For the same reason the times are still the device's word, within the bound above.

The seed of a daily is an ordinary seed. Typed into `/zip/play?seed=...` it used to open the daily's board as practice, stored under the same key, with a Reveal that closed nothing. The seed of a daily that can still count, today's or yesterday's, now redirects to the daily page (`useDailySeedRedirect`), which shows today's puzzle in the player's game language. Seeds of older dailies still open as practice.

### Points

```
points = max(20, 100 - 10 * hints) + round(50 * min(1, par / time))
```

100 for solving, minus 10 per hint, plus up to 50 for speed. `par` is 1 minute on easy, 2 on medium, 4 on hard and 6 on expert. Solving within par earns the whole bonus, and twice the par time earns half of it. The rule is in `src/shared/online/scores.ts`.

### What is ranked

| View | Order |
| --- | --- |
| One game, today | Time, lowest first. Everyone solved the same puzzle. A hint counts as 30 seconds. |
| All games today, or any view of the week, the month or all time | Points, summed. |

A week runs from Monday to Sunday and a month is the calendar month, both on the Pacific calendar, the calendar of the daily puzzles. "All time" starts with the first score ever recorded.

The pages read rankings through TanStack Query (`useRanking`), which asks again every 30 seconds while the page is in view, so a table left open follows the day. A refresh that fails keeps the table already on screen.

Termo and Wend have one daily puzzle per language. Their ranking by time is per language, since the puzzles differ. Their points all go to the same player.

The response holds the top 50, and the asking player's own row when they are below that.

### Streaks

`players.streak_current` counts consecutive days with at least one solved daily puzzle, in any game. It shows as a flame next to a player from two days up. It is separate from the per-game streak on the device, which works offline and is what the hub and the result screen show. The two count different things: the server's is one streak across all games, the device's is one per game. The sync writes the player's closes of the last 400 days into the device, so a device that has synced shows per-game streaks built from the same closes.

### API

| Request | Does |
| --- | --- |
| `POST /api/scores` `{ game, variant?, date, number, difficulty, size, elapsedMs, hintsUsed, mistakes, moves?, revealed?, failed?, board? }` | Closes a daily puzzle. Answers `{ points, recorded, record, player }`: `record` is how the daily stands for the player, and `player` is whose it is, or `null` when a reveal or a loss came from a device without one. |
| `GET /api/daily` | `{ player, today, records, opens }`: the player's closed dailies of the last 400 days, and the open ones of today and yesterday. With `unavailable: true` on a site without a database. |
| `POST /api/daily` `{ game, variant?, date, hints }` | Notes that a daily is open and how many hints were used. Never creates a player. |
| `GET /api/ranking?period=today\|week\|month\|all&game=all\|<id>&variant=` | A ranking. |

### Trust

The time comes from the player's device, and the server cannot prove a solve was honest. What it can do cheaply, it does:

- Number, difficulty and seed come from the game's daily schedule (`src/games/daily.ts`), not from the request. The request still has to carry a number and a difficulty, as older clients send them, and they are ignored. A claim of "expert" for an easy day earns nothing extra.
- A variant is accepted only for a game with one daily per language, and only for a language it has. Anything else would be one more scored puzzle for the same day.
- The time is at least the time since the server saw the player open the puzzle, and the hints at least what any device reported.
- Yesterday's puzzle counts only when it was opened before midnight Pacific, or in the first six hours of the new day.
- A time under one second or over a day is refused, and so is a second close of the same puzzle.

A write that a page of another site set off is refused (`isCrossSiteWrite` in `src/server/http.ts`). Without that, such a request, arriving without the visitor's cookies, would be answered with a new player's cookie and replace the one the device had.

That is enough for a ranking among friends. A real defence would generate and check puzzles on the server.

## Streak reminders

A player can ask to be reminded on the day their streak is about to end. It is a Web Push notification, so it arrives with the site closed. On iOS that only works in the installed app, which is one reason the site invites phones to install it.

### Subscribing

The switch is in the settings, and the home screen offers it to a player with a streak. Turning it on asks the browser for permission, subscribes with the server's public key, and posts the subscription to `POST /api/push` with the page's language and the device's time zone. The row in `push_subscriptions` belongs to the current player. A device asks again each time the app opens and after signing in or out, so a change of language, a trip or a change of player is picked up. A player keeps up to 8 devices. One more replaces the oldest.

The subscription follows the player on the device. Signing out deletes the row first, so a signed-out device stops hearing about the account. Signing out the other devices deletes every row of the account. Merging a device player into an account moves its rows to the account. A device left with no player at all drops its subscription in the browser too (`refreshPush`), so whoever plays there next is asked again.

The key of a subscription has to be a point of the P-256 curve, which `subscribe` checks. A message cannot be encrypted for anything else.

The endpoint of a subscription is a URL the server will send requests to. `isPushEndpoint` (`src/shared/online/push.ts`) takes only `https` URLs on the default port at the push services of the browsers that have one: Google's, Mozilla's, Microsoft's and Apple's. Anything else is refused, so the route cannot be used to make the server call an address of the caller's choosing.

### Sending

`vercel.json` schedules `GET /api/cron/reminders` once an hour. Vercel calls it with the project's `CRON_SECRET` as a bearer token, and the route refuses every other caller. `sendReminders` (`src/server/push.ts`) then picks the devices that are due:

- the player's streak ends today: the last day they scored is yesterday on the Pacific calendar;
- it is the hour for it where the device is (`isReminderHour` in `src/shared/online/push.ts`);
- the device has not been reminded today.

The hour follows the deadline. The day that counts ends at midnight Pacific, which is 05:00 in Sao Paulo, 08:00 in Lisbon and 17:00 in Tokyo. So a fixed evening hour would be right in the first two and two hours late in the third. The rule has two parts, both between 09:00 and 21:59 local:

- from 19:00, when waiting for the next morning would leave less than three hours to play. That is the evening reminder of the Americas, Europe and Africa;
- at any of those hours, once five hours or fewer are left. That is 12:00 in Tokyo, 14:00 in Sydney and 16:00 in Auckland.

Both stay true for the following runs, so a run that failed is made up for an hour later. No hour passes the rule in the first eight hours of a Pacific day, which is why a device marked for a day cannot be due twice in it.

Each device is marked before its message goes out (`last_sent`), so two runs that overlap cannot both send. A send that got no answer, a 429 or a 5xx takes the mark back, and the next run tries again. The player is marked too (`players.reminded_on`), and a subscription made later that day starts as reminded: signing out and in again makes a new row, and must not earn a second reminder.

A push service holds a message for a device it cannot reach. The time it may do so is cut to whichever comes first: four hours, the end of the Pacific day, or 22:00 where the device is. A run sends 12 messages at a time and stops taking on devices after 90 seconds. What is left waits an hour, and the devices reminded longest ago go first. The text is written on the server in the device's language, from `common.reminder` in the message files, the same files the interface uses. The message is encrypted for the device and signed with the site's VAPID key (`web-push`). A push service that answers 404 or 410 gets the subscription deleted, and five failures in a row do too.

### Setting it up

Three environment variables, in the Vercel project and in `.env.local`:

```
VAPID_PUBLIC_KEY     the key browsers subscribe with
VAPID_PRIVATE_KEY    the key the server signs with
CRON_SECRET          the token the scheduler presents
```

`npx web-push generate-vapid-keys` makes a pair. Changing the pair invalidates every subscription. Without the keys the feature is off: `GET /api/push` answers `key: null` and nothing is offered. `PUSH_DRY_RUN=1` makes a run mark who was due without sending, which is how the tests run it. Only such a run accepts `?at=<time>` to say what time to pretend it is.

### API

| Request | Does |
| --- | --- |
| `GET /api/push` | `{ key }`: the public key, or `null` when reminders are not set up. |
| `POST /api/push` `{ subscription, locale, timezone }` | Subscribes this device for the current player. An existing subscription changes only when the keys match the stored ones. |
| `POST /api/push` `{ action: "status", endpoint }` | `{ key, subscribed }`: whether that endpoint is subscribed for the current player. The endpoint travels in the body so it stays out of logs. |
| `DELETE /api/push` `{ endpoint, auth }` | Stops the reminders of a device. Both values are needed, and only the device has them. |
| `GET /api/cron/reminders` | Sends the reminders that are due, and deletes sessions unused for 180 days. Scheduler only. |

## Cookie notice and legal pages

A first visit gets a notice at the bottom of the page (`src/shared/ui/consent-banner.tsx`): what the site keeps in the browser, with links to the privacy policy and the terms of use. It has one button, Accept. Every cookie the site sets is needed for something the visitor asks for, so there is nothing to refuse piece by piece. The policy says how to block cookies in the browser, and what stops working then. The answer is kept in local storage under `minigames:consent:v1`.

`/privacy` and `/terms` are static pages in both languages. Their text is in `src/shared/legal/en.ts` and `pt-br.ts`, typed by `content.ts` so both languages keep the same shape. They are TypeScript and not message files because they are long texts with a fixed structure, read top to bottom.

The privacy policy lists what is stored: the four cookies (`NEXT_LOCALE`, `play_player`, `play_session`, `play_challenge`), what stays in the browser (settings, progress, the offline copy) and each table of the database. It has to stay true. A change that adds a cookie, a table or a provider changes both texts and `LEGAL_UPDATED` in the same commit. `e2e/platform/legal.spec.ts` checks that a visit and a score set the cookies the policy names and no others.

The texts were written to describe the code plainly, and were not reviewed by a lawyer.

## Not built yet

- Account recovery. It needs an email address or a recovery code, and the site stores neither.
- Copying a board that is still being played, or best times, between devices. An account carries the player and the dailies the player has closed, and nothing else a device has saved.
- A way to stay out of the ranking while keeping scores.
- Rate limits at the edge. The API has per-player limits for rooms only. The Vercel Firewall can cap requests per address without code.
- A filter or a report button for names and nicknames.
