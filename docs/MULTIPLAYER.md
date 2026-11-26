# Challenge rooms

A challenge room is a race through a fixed list of puzzles. One player opens the room, picks the rounds and shares a link. Everyone who joins gets the same seeds, so the same boards, and the table shows who solved the most rounds in the least time.

The code is in `src/shared/online/` (rules, client, screens), `src/server/rooms.ts` (the server side) and `src/app/api/rooms/` (the route handlers). The rules are pure functions in `src/shared/online/rooms.ts`, covered by `tests/shared/online.test.ts`. `e2e/platform/rooms.spec.ts` plays whole races with two browsers.

## How a race goes

1. The host opens `/rooms/new`, usually from the "Challenge friends" button of a game's practice setup, which arrives with that game picked.
2. The host sets the number of rounds, 1 to 10, with a slider. Each round has a game, a difficulty (a mode for Termo) and a board size, or "Auto" to let the difficulty pick it. A round made of words also fixes the language, so everyone gets the same words whatever their own game language is.
3. The server creates the room with a five-character code such as `NM73Y` and the host lands in its lobby at `/rooms/NM73Y`.
4. The host shares the link. It has no locale, so each person who opens it is sent to their own language. They see who invites them and what will be played, pick a name, and join.
5. The host presses "Start the race". Every lobby moves to the first board within a poll.
6. Each player plays round after round. The next board opens by itself when a round ends. After the last one the player lands on the room's table.
7. When someone finishes the whole race, the others get a short notice at the top of the screen, with "Keep going" and "Give up". It does not cover the board and goes away after nine seconds.
8. The race is over when every player has finished, given up or gone away. The host can then open a new room with the same rounds, and the old table shows everyone the way in.

Up to 12 players fit in a room. A room can still be joined after the start, because each player has their own clock.

## The clock

A player's clock starts when their first board comes into view and stops when their last round ends. It never pauses. Time between rounds counts, and so does time away from the page: closing the tab, switching apps or reloading changes nothing, because the clock is not on the device.

Every timestamp is the database's `now()`. The client reports events ("this board is on screen", "this round ended") and the server writes down when it heard them. A player cannot shorten their race by changing their device's clock. What is shown while racing is the server's time, moved forward by the time since the last answer (`useRoom().serverNow`).

Each player starts at their own first board, not at the host's click, so a slow connection or a late join costs nothing.

## Who wins

`rankRoom` orders the table:

1. More rounds solved comes first. A revealed puzzle, or a lost Termo, is a round played but not solved.
2. Among players with the same rounds solved, one who finished is ahead of one still racing, and one who gave up is behind both.
3. Then the lower time wins. Each hint adds 30 seconds.

Rule 1 is what makes the race fair. Revealing every board is the fastest way to the end, and without it a player who solved nothing would beat one who solved everything slowly. With it, skipping a round can never beat solving it.

Hints stay available because being stuck with no way forward is no fun in a party game. They cost more than thinking does, since a hint solves part of the puzzle.

Each row of the table also shows the time of every round the player has played, one cell per round: `standingOf` returns them as `splitsMs`, measured from the end of the round before. A round that was not solved keeps its time, struck through, and the fastest solve of each round is marked. The cells form a grid of fixed columns, so the same round sits in the same place in every row.

## How the games take part

No game knows about rooms. A round is played on the game's ordinary seeded route, with two more query parameters:

```
/zip/play?seed=ZIP%3ArQk3...%3A2%3Aeasy%3A5&room=NM73Y&round=1
```

The shared game frame (`src/shared/ui/game-frame.tsx`) reads them through `useRace`. In a race it:

- shows the race strip above the header: the round, the race clock, the other players with the round each one is on, and "Give up". On a phone the strip shows two players and counts the rest;
- tells the room when the board comes into view and when the round ends;
- hides "New game" and "Try again", and skips the result screen, best times and the ranking;
- opens the next round, or the table, about a second after the round ends.

A player who lands on a round that is not theirs is sent to the room's page: someone who has not joined, a link to a later round, a seed that is not the round's seed. A round that was already reported is not played twice. Going back to it with the browser's back button sends the player forward again.

The seeds come from tokens the server generates when the room is created. The tokens stay on the server while the room is a lobby, so nobody can open a board before the start.

## Transport: why polling

The clients learn about changes by asking for the room every 1.5 seconds while the tab is visible, and every 8 seconds while it is hidden. Three options were on the table.

### WebRTC, peer to peer

The players' browsers talk to each other directly, and the server only helps them find one another.

- It needs no database for the game state, which is what makes it attractive.
- It still needs a signaling server to connect the peers. That is either a third-party service (the public PeerJS server, BitTorrent trackers or Nostr relays through a library such as Trystero) with no guarantee it is up, or one of our own, which needs shared state on the server anyway.
- Direct connections fail between some networks. Mobile carriers that put many customers behind one address (carrier-grade NAT) and strict office or campus firewalls are the usual cases. The fix is a TURN relay, which is a paid server that carries all the traffic. A link shared on WhatsApp is mostly opened on phones, on exactly those networks.
- The state lives in the host's browser. If the host closes the tab, the room is gone. Moving the host role to another peer, and agreeing on times without a neutral clock, is real work.

WebRTC earns its complexity when peers exchange a lot of data with low latency: video, voice, a shared cursor, an action game. A puzzle race exchanges a few events a minute.

### WebSockets

Vercel Functions support WebSockets now (`upgradeWebSocket` from `@vercel/functions`, on Fluid Compute), so this is possible on the current hosting.

- Two players of the same room can be connected to two different function instances. For one to hear about the other, the instances need a shared channel: Redis pub/sub, or Postgres LISTEN/NOTIFY. So the socket does not remove the need for a store. It adds a second moving part on top of it.
- A function has a maximum duration. A socket is closed when it is reached, so the client needs reconnection logic and a way to catch up on what it missed. Catching up is a request for the current state, which is what polling already is.
- The gain is latency: an event arrives in tens of milliseconds, not within a second and a half.

### HTTP polling against one database (chosen)

The room is a row in Postgres, and every player's page asks for it on a timer.

- It works on every network that can load the site. There is nothing to connect and nothing to keep alive.
- The server is the one source of truth and the one clock. The host can leave and the race goes on. A player can reload, switch devices in the middle of nothing, or lose signal for a minute, and the next answer puts them back in step.
- Every change is one conditional SQL statement, so two requests arriving together cannot start a room twice or record a round twice.
- The cost is requests. Four players for ten minutes are about 1,600 requests, each one query over HTTP. A hidden tab asks five times less often.
- The delay is at most a poll. For "Ana joined", "the race started" and "Ana finished round 2" that is not noticeable. Nothing in the race depends on who sees an event first, because times are taken on the server.

The site also wanted a database for the ranking, so the store was not an extra cost.

### If the game changes

Polling stops being the right answer if rooms ever show something that changes many times a second, such as another player's cursor or their board as they draw. The step up is a WebSocket per room with Postgres LISTEN/NOTIFY or Redis behind it, keeping the same tables and the same HTTP endpoints as the fallback and the catch-up path. Neon also offers a realtime option on the database that could play that role. The client's `useRoom` hook is the only place that would change.

## Data

Two tables (see `src/server/schema.ts`):

- `rooms`: `code`, `host_id`, `status` (`lobby`, `racing`, `finished`), `rounds` (JSON: game, difficulty, size, language, token), timestamps and `rematch_code`.
- `room_players`: one row per player in a room, with `started_at`, `finished_at`, `gave_up`, `last_seen_at` and `results`, a JSON list with one entry per round played: `{ at, solved, hints }`.

Reading a room is also the heartbeat: it updates `last_seen_at`, at most once every five seconds. A player not seen for 45 seconds is "away", and the race does not wait for them. If the host of a lobby is away for a minute, the player who has been there longest becomes the host.

Rooms older than 36 hours are deleted when a new room is created. There is no scheduled job.

## API

All under `/api/rooms`, JSON in and out. Errors are `{ "error": "<code>" }`.

| Request | Does |
| --- | --- |
| `POST /api/rooms` `{ rounds, rematchOf? }` | Opens a room. The caller becomes the host. |
| `GET /api/rooms/:code` | The room as it is now. Anyone with the code may look. |
| `POST /api/rooms/:code` `{ action: "join" }` | Joins, creating the device's player if it has none. |
| `POST /api/rooms/:code` `{ action: "start" }` | Starts the race. Host only. |
| `POST /api/rooms/:code` `{ action: "progress", event: "view", round }` | A board came into view. |
| `POST /api/rooms/:code` `{ action: "progress", event: "round", round, solved, hints }` | A round ended. Accepted only for the player's next round. |
| `POST /api/rooms/:code` `{ action: "progress", event: "give-up" }` | Leaves the race and stays in the table. |
| `POST /api/rooms/:code` `{ action: "leave" }` | Leaves a lobby. |

Error codes the interface handles: `no-room`, `room-full`, `room-finished`, `not-host`, `no-player`, `invalid-rounds`, `too-many-rooms`, `unavailable`.

## Limits and trust

- A host can open 30 rooms an hour.
- The client says whether a round was solved and how many hints it took. The server checks the order of rounds and takes the times itself, but it does not replay the solution. Among friends that is enough. A check on the server would need each game's engine there, and is the place to start if rooms ever feed a public ranking.
- Rooms do not count for the ranking, for the daily streak or for best times.

## Not built yet

- Seeing the other players' boards, or their progress inside a round.
- Changing the rounds after the room is open.
- Teams, or a best-of series with points per round.
- Spectators with their own view. Anyone with the link can already watch the table.
