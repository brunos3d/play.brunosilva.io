# Architecture

This repository is a small platform of daily logic puzzles. It currently holds seven games, Zip, Patches, Chess, Queens, Sumbreak, Wend and Termo, and is built so that the next one needs no changes to the others. It is a Next.js 16 app (React 19, TypeScript strict, Tailwind 4). Every puzzle is generated in the browser and all progress stays on the device. The site reads in two languages ([I18N.md](I18N.md)), and two features use a server and a database: challenge rooms ([MULTIPLAYER.md](MULTIPLAYER.md)) and the ranking ([ONLINE.md](ONLINE.md)).

## Layout

```
src/
  proxy.ts                redirects the shortcut domains to the canonical one, and a path without a locale to the visitor's
  i18n/                   locales, detection, navigation, message loading, the game language
  app/                    routes only, no logic
    [locale]/             every page: the document itself is built here, once per locale
      page.tsx            hub
      zip/ patches/ chess/ queens/ sumbreak/ wend/ termo/   daily (index), play (seeded), practice (setup)
      rooms/new/ rooms/[code]/ ranking/                     challenge rooms and the ranking
      profile/ privacy/ terms/                              the player's profile and account, and the legal pages
      [...rest]/          old Zip links, and the 404 of everything else
    api/                  route handlers: session, account, rooms, scores, daily, ranking
  server/                 database access, players, accounts (passkeys), rooms, scores (server only)
  games/
    registry.ts           id, route and shape of every game
    daily.ts              the daily puzzle of every game, by id: the hub, the sync and the server ask the same table
    codecs.ts             the seed format of every game, by id
    zip/      engine/ components/ hooks/ storage/
    patches/  engine/ components/ hooks/ storage/
    chess/    engine/ components/ hooks/ storage/
    queens/   engine/ components/ hooks/ storage/
    sumbreak/ engine/ components/ hooks/ storage/
    wend/     engine/ components/ hooks/ storage/
    termo/    engine/ components/ hooks/ storage/
  shared/
    engine/               prng, seed codec, daily schedule, Pacific time, streak, clock, difficulty
    storage/              IndexedDB wrapper, settings, progress (boards, daily results, best times)
    platform/             audio, haptics, share, result builder, service worker registration
    hooks/                settings store, game clock, daily date, deferred generation, game language, game text
    online/               challenge rooms, ranking, profile and account: rules, client, screens
    legal/                the privacy policy and the terms of use, one module per language
    ui/                   theme.css, icons, dialogs, header, controls, status line, result, practice setup, hub
messages/                 en/ and pt-br/, one JSON file per namespace
public/                   sw.js, manifest.webmanifest, icons/
scripts/                  one folder of CLI tools per game, shared/, make-icons.ts
tests/                    shared/ and one folder per game (Vitest)
e2e/                      platform/ and one folder per game (Playwright, production build)
```

Dependencies point one way. A game imports `shared`, never another game. `shared` imports a game in exactly two places, both about listing games: `games/registry.ts` for names and routes, and `games/daily.ts`, the table of each game's daily info and puzzle id, which the hub, the sync between a player's devices and the server all read. The hub must stay small, so a game that ships data, as Wend and Termo do with their words, keeps its daily schedule and puzzle id in modules that do not import the generator (`engine/daily.ts` and `engine/seed.ts`). Each `engine/` folder is pure TypeScript with no React, DOM or storage, which the CLI tools and unit tests prove by running it in plain Node.

The UI never decides a rule. A board turns pointer and key events into a rectangle (Patches), a cell (Zip, Queens), a pair of cells (Chess, Sumbreak), a trail of cells (Wend) or a typed word (Termo) and hands it to its hook, and the engine answers whether the move is legal, whether the puzzle is complete and what the next hint is.

## Adding a game

1. Add an entry to `games/registry.ts` and to `games/codecs.ts`, and the game's name, tagline, description, mistake label and practice blurb to `messages/<locale>/games.json`. `hasSizes: false` is for a game whose boards all have one size, as in chess: the size then stays out of headers, results, share text and the practice setup.
2. Create `games/<id>/engine` with a seed codec (`createSeedCodec`), a generator, a daily config and a pure game state.
3. Write a hook that returns a `GameSession` (see below) and a board component. Put every sentence in `messages/<locale>/<id>.json` and add the namespace to `i18n/messages.ts`. The engine returns data, and a `text.ts` next to it builds the sentences (see [I18N.md](I18N.md)).
4. Add `app/[locale]/<id>/` with the three routes, an icon in `public/icons/` and in `shared/ui/game-icons.tsx`, and the routes to `ROUTES` in `public/sw.js`. Bump the cache name there, so installed copies fetch the new pages.
5. Register the game's daily info and puzzle id in `DAILY_GAMES` in `games/daily.ts`. Wrap the game of the daily page in `DailyGate` (`shared/ui/daily-gate.tsx`) with that puzzle id, and call `useDailySeedRedirect` in the seeded page, as the other games do: a daily counts once per player, on every device (see [ONLINE.md](ONLINE.md)).
6. Add a shortcut to `public/manifest.webmanifest`, an icon target to `scripts/make-icons.ts`, a card to `scripts/make-og-images.ts`, and the game to `skipTutorials` in `e2e/shared.ts`.

Chess, Queens, Sumbreak, Wend and Termo were added this way. None of them changed a line of the games that came before.

Termo is the first game that can be lost, the first with no undo and the first whose tiers are modes with names of their own. It added six optional pieces to the shared code. A game that does not use them behaves as before:

- `hiddenControls` on the frame leaves out Undo, Reset or both, and the row of controls closes up.
- `started` on the session tells the frame that the player has put something on the board. Without it the frame falls back to "there is something to undo or reset".
- `failed` on the finish summary marks a lost game. It always comes with `revealed`, so a loss closes the day and earns no streak and no best time, like a revealed puzzle. The result screen and the hub word it differently: "Out of guesses" and "Not solved".
- `shareDetail` on the frame adds lines to the shared result. Termo puts its grid of coloured squares there.
- `difficultyLabels` in the registry names the tiers. Termo shows "Termo", "Dueto" and "Quarteto" where the others show "medium", "hard" and "expert", in the header, on the hub, on the result screen and in the shared text. Seeds keep the four tiers.
- `resultActions` on the frame puts the game's own links on the result screen. Termo offers the day's Dueto and Quarteto there.

The result screen stays short on purpose. It suggests at most two other games whose daily puzzle is not finished yet, in hub order, and one more link leads to the hub for the rest. A game that passes `resultActions` shows those in place of the suggestions.

Header, controls, dialogs, results, streaks, best times, sharing, settings, the clock, sounds and offline support come from `shared`.

## The game frame

`shared/ui/game-frame.tsx` is everything around a board: header, status line, the controls (Undo, Hint, Reveal, Reset, and New in practice mode), the tutorial slot, settings, the reveal confirmation, the result dialog, the Z and H shortcuts and the moment the clock starts. A game plugs in through one interface:

```ts
type GameSession = {
  ready: boolean; locked: boolean; elapsed: number; status: StatusMessage;
  hintsUsed: number; canUndo: boolean; canReset: boolean;
  summary: FinishSummary | null;   // set once the puzzle ends
  endedNow: boolean;               // false when a finished board is reopened
  begin(): void; undo(): void; reset(): void; requestHint(): void; reveal(): void;
};
```

The frame takes an optional `statusSlot`, which replaces the status line. Chess uses it for its coach, who speaks in a chat instead of a single line (see `docs/chess/CHESS.md`). A slot has to announce the session's status itself.

The frame takes an optional `onNext`. Practice pages pass it, and the frame then shows New as a fifth control and "New game" next to "View result" on a solved board. It loads another board with a fresh seed, and since the view is keyed by puzzle id, the clock starts over with it. Daily pages do not pass it.

`usePatchesGame` and `useZipGame` both return the session. When `summary` appears, the frame calls `buildResult`, which records the daily result, the streak and the best time (or only reads them, when `endedNow` is false) and opens the result dialog. `GameView` components are mounted with `key={puzzle.id}`, so a new puzzle always starts from a clean hook.

## The way home

The game's mark and name in the header are one link to the hub, because that is where players look for it first. The right side of the header holds help, the theme button, the language menu and the settings. The link goes through the frame: once the player has made a move on an unfinished board (`started`, or else `canUndo` or `canReset`), the frame asks "Leave this puzzle?" before navigating, and says why it asks: the board is saved, but the clock keeps running. A board that is untouched or already finished leaves at once, and a modified click (new tab) is never intercepted.

## Platform rules shared by every game

- **Hints act, and they are counted.** A hint first looks for a mistake (a patch no solution contains, a path that left the solution, a wrong queen, a wrong chess move still on the board, a Sumbreak merge that left the board unsolvable, a Wend trail that is not the start of a hidden word), flags it and takes it off. Otherwise it plays the next forced move itself, with a one-sentence reason. Chess splits that in two: the first hint shows the piece, the second plays the move. Every generated puzzle has a proven solution, so a hint is never a guess. In Sumbreak, where many orders of merges work, the solver knows for every position whether it can still be finished. Wend and Termo have no forced move to play, so their hints reveal one letter.
- **Reveal** asks for confirmation, then plays the solution piece by piece. The puzzle ends as `revealed`: the day is closed, but it earns no streak credit, sets no best time and cannot be shared. A lost Termo game is stored the same way with `failed` on top, and that one can be shared. A game refuses `reveal()` while a hint is still drawing, so the frame asks again every 100 ms until the board locks: a confirmation given during that pause is not lost.
- **Reset** clears the board and the undo stack. The clock and the counters survive, so a reset cannot polish a result.
- **Try again** is offered once a practice puzzle is over, next to "View result" and "New game", and on the result screen. It plays the same seed from the start with a fresh clock. `shared/ui/puzzle-attempts.tsx` wraps each game's board: it erases the saved board, notes the seed in `shared/storage/replays.ts` and mounts the game again, so no game has code for it. A replay is played with the answer already seen, so `buildResult` records no best time for it and the result screen says so. Daily puzzles have no Try again.
- **Illegal moves change nothing.** The board shakes, the offending cell or rectangle is hatched, a sound plays and the status line names the rule. Feedback never relies on colour alone. In Chess a move can be legal and still wrong: that one is played, marked and explained, and it waits on the board to be taken back. Sumbreak plays such a merge without a word, as the original does, and counts it for the result screen. Wend keeps any trail the player draws and only gives it colour when it is a hidden word.
- **Sound is on by default**, vibration too. Settings are one store for the whole platform. Tones are synthesized in `shared/platform/audio.ts`. Per-sound gains only set how the sounds relate to each other, and one constant, `MASTER_VOLUME`, sets the overall loudness. Everything goes through a limiter, because a fast Zip drag fires overlapping tones that could otherwise clip. An e2e test wraps the Web Audio calls and checks that tones fire, at what level, and through which nodes, since nobody can listen in a headless run.

## The clock

`shared/engine/clock.ts` is plain data: `{ startedAt, finishedMs }`, with `startedAt` in epoch milliseconds.

- It starts the first time the player sees the board: progress has loaded and no tutorial covers it. Nothing has to be touched.
- Elapsed time is "now minus `startedAt`". A hidden tab, a reload or a closed browser cannot stop it, because nothing is counting: the value is recomputed on return. Leaving to look something up costs time.
- It stops once, when the puzzle ends, and stores the final time in `finishedMs`.
- `startedAt` is saved with the board the moment the clock starts, so a reload right after opening the puzzle does not give the time back.

This replaced an earlier monotonic timer that paused while the tab was hidden. The wall clock can be fooled by changing the system time, which a monotonic clock cannot, but only the wall clock survives a closed tab, and that is the behaviour asked for. Elapsed time is clamped at zero, so a clock set backwards cannot produce a negative result. The hub reads the same `startedAt` and shows "Clock running" with the live time for a daily puzzle that was opened and left.

## Persistence

One IndexedDB database, `minigames`, with keys that carry the game id:

| Data | Store | Key |
|---|---|---|
| Board, undo history, counters, clock | `games` | `<game>:<puzzle id>` |
| Daily results | `daily` | `<game>:<Pacific date>`, or `<game>@<language>:<Pacific date>` for a game with one daily per language |
| Best times | `stats` | `best:<game>:<difficulty>:<size>` |
| Sound, vibration, theme, game language, tutorials seen | localStorage `minigames:settings:v1` | |
| Interface language | cookie `NEXT_LOCALE` | |
| Who the device is, for rooms and the ranking | cookie `play_player` (httpOnly) | |

The hub reads `startedAt` and `finishedMs` from the top level of a board snapshot to show a running clock, so every game's snapshot carries them there.

Each game owns its snapshot format and treats stored data as untrusted. On load, Patches rebuilds every region and runs it through `validateRegion`, Zip walks the stored path through the move rules again, Queens checks every stored queen against the rules, Chess checks that the stored progress fits the solution line, Sumbreak plays every stored merge again, Wend checks every stored trail against the board and works out again which ones are found words, Termo checks every stored guess against its word list and scores the game again, and a "solved" flag only survives if the full validator agrees. A finished board must carry a final time and an unfinished one must not. Anything off is dropped and the board starts fresh.

Boards are saved when the clock starts, after every move (in Zip after every gesture, not every cell) and when the puzzle ends. The first result of a date is the one that counts. Every IndexedDB call degrades to a no-op when storage is unavailable, so the games still play in a private window.

## Visual system

`shared/ui/theme.css` defines the tokens on `:root` (linen, ink, thread, accent) and again under `:root[data-theme="dark"]`, plus the page shell, buttons, dialogs, the status line and the tile board. The theme is a setting: `system`, `light` or `dark`. An inline script in `<head>` resolves it and sets `data-theme` before the first paint, and `ThemeSync` keeps it current, so the stylesheets have no `prefers-color-scheme` rule. The display face is Fraunces and the text face is Bricolage Grotesque, both self-hosted by `next/font`. Icons are hand-drawn SVG components in `shared/ui/icons.tsx`. No icon library is used.

All boards are DOM, not canvas: `role="gridcell"` elements in a CSS grid with absolutely positioned layers on top, sized in percent. Every cell draws a rounded tile, and patches, previews, hints and visited Zip cells use the same `--tile-gap` and `--tile-radius`, which scale with the cell through container query units. The board width is rounded down with CSS `round()` to a whole number of pixels per cell, and the left margin is rounded too, because plain centring leaves half a pixel on each side whenever the leftover width is odd. E2e tests assert an integer grid origin and integer cell size at seven viewport sizes for both games.

Each game adds one stylesheet for what is unique to its board: `patches.css`, `zip.css`, `chess.css`, `queens.css`, `sumbreak.css`, `wend.css` and `termo.css`, each in its game's `components/` folder. Wend and Termo put more than a board on the stage (a word list, a keyboard), so each of them also sets the stage width for itself with a `:has()` rule. The chess board keeps the shared container and grid and makes the tiles flush, and its squares and pieces keep the same colours in both themes.

## Phone layout

The site is laid out for a phone first: one column, at most 560 px wide, with nothing that needs a hover. Three widths are the reference: 320 px (the narrowest phone still in use), 360 px (most Android phones) and 412 px (a large phone). Portuguese labels run longer than English ones, so every screen has to fit in both languages.

A few rules in `shared/ui/theme.css` keep text whole instead of breaking or cutting it:

- `.mg-actions` is a row of buttons that becomes a column when the labels do not fit side by side. `data-even="true"` asks for equal halves, as in Cancel and Confirm.
- `.mg-player-line` holds a player's name and the tags after it ("you", "host"). The tags move under the name before they squeeze it, and the name wraps instead of ending in an ellipsis.
- `.mg-stats` gives a long label ("Redesenhos") the room it needs from the two tiles beside it.
- `.mg-select` draws its own arrow, so the room for the text is the same in every browser, and uses 16 px text, as `.mg-field` does, so iOS does not zoom the page on focus.
- `.mg-text-link` gives a standalone text link a 28 px target.
- Under 400 px the race strip shows two faces and counts the rest. Under 380 px a row of a table tightens and the strip drops the word "Round". Under 340 px buttons and cards lose a little padding, and the puzzle's number goes under the game's name in the header.

A rule in `theme.css` is not layered, so it wins over a Tailwind utility on the same property. A component that needs another value for an `mg-` class sets it in the stylesheet or with `style`, not with a utility class.

`e2e/platform/responsive.spec.ts` walks every screen at the three widths, in both languages: the hub, each game's daily puzzle with its dialogs, practice, the tutorial, the ranking, and a challenge room from the setup to the final table with eight players. `e2e/layout.ts` holds the checks: nothing scrolls or sticks out sideways, no button, tab, chip or title breaks in two, no text is cut off or runs out of its box, placeholders and select options show whole, and every control is at least 24 px in both directions (WCAG 2.5.8). To look at the screens themselves, run it with a folder for screenshots:

```
LAYOUT_SHOTS=/tmp/shots npx playwright test e2e/platform/responsive.spec.ts --project=mobile
```

When a label does not fit, shorten the text in `messages/` first. Change the layout when the short text would stop being clear.

## Input

Every board uses Pointer Events, so mouse, touch and pen share one path, and sets `touch-action: none` so a drag never scrolls or zooms the page. Pinch zoom stays available outside the board.

Two lessons from Patches apply to both. The gesture lives in a ref and React state only mirrors it for rendering, because React batches `pointermove` updates and a handler that read the gesture from state could start from stale data. And handlers walk `getCoalescedEvents()`, because browsers merge fast moves into one event and the merged points are cells the finger really crossed. Each game has an e2e test that fires a whole drag inside one task, with no render in between.

Game-specific interaction is described in `docs/zip/ZIP.md`, `docs/patches/PATCHES_REFERENCE.md`, `docs/chess/CHESS.md`, `docs/queens/QUEENS.md`, `docs/sumbreak/SUMBREAK.md`, `docs/wend/WEND.md` and `docs/termo/TERMO.md`.

## Domains

The platform lives at `play.brunosilva.io`, defined once as `SITE_ORIGIN` in `shared/platform/site.ts`. The root layout uses it for `metadataBase` and the canonical link.

`zip.brunosilva.io` and `patches.brunosilva.io` are shortcut domains. Chess and Queens have none yet: adding one is a DNS record, a domain on the Vercel project and one line in `GAME_HOSTS`. `src/proxy.ts` (the Next.js 16 name for middleware) redirects any request that arrives on one of them with a 308:

| Request | Goes to |
|---|---|
| `zip.brunosilva.io/` | `play.brunosilva.io/zip` |
| `patches.brunosilva.io/` | `play.brunosilva.io/patches` |
| `zip.brunosilva.io/practice` | `play.brunosilva.io/zip/practice` |
| `zip.brunosilva.io/play?seed=...` | `play.brunosilva.io/zip/play?seed=...` |
| `zip.brunosilva.io/hard/42` (old Zip link) | `play.brunosilva.io/hard/42`, which redirects again to `/zip/play` |

The target never has a locale: this redirect is permanent and cached, and the locale depends on the visitor. On the canonical address the proxy then adds it in a second step, a 307 (see [I18N.md](I18N.md)).

The rule is the pure function `resolveHostRedirect`, unit tested, and an e2e test drives the real proxy in the production server. The host is read from `x-forwarded-host` first, which is where Vercel's edge puts the public host. The target origin is a constant, so a forged header can only send a visitor to this site. Any other host (the canonical one, Vercel previews, localhost) is served normally. Adding a shortcut domain is one line in `GAME_HOSTS`.

All three domains have to be attached to the same Vercel project for the proxy to see the requests. Browser storage is per origin, so progress made on `zip.brunosilva.io` before the move does not follow the player to `play.brunosilva.io`.

## Open Graph images

The hub and each game have their own 1200x630 image: `public/og/home.png`, `zip.png`, `patches.png`, `chess.png`, `queens.png`, `sumbreak.png`, `wend.png` and `termo.png`. They are static files, rendered once by `npm run og` and committed, so nothing is generated per request or per build. The script lays out an HTML card (title and tagline on the left, the game's icon on the right) with the site's fonts and the SVG marks from `public/icons`, and takes a screenshot with Playwright's Chromium. Texts come from `messages/en/games.json`, so the images are re-rendered only when a name, a tagline or an icon changes. The images are in English, and both locales link to them.

A child route segment replaces its parent's `openGraph` metadata as a whole, so each game layout repeats every field. An e2e test checks the tags on all eight pages and reads the PNG header of each file to confirm its size.

## PWA and offline

`public/sw.js` is registered in production with scope `/`.

- Precache: the page tells the worker its locale, and the worker fetches the hub and the three pages of each game in that locale, caches them, then caches every `/_next/static/...` URL found in their HTML. This covers the first visit, when the page loaded before the worker could see its requests. The other locale is cached page by page if the player switches.
- Navigations: network first, cached page as fallback. The query string is ignored on fallback, because `/en/zip/play?seed=...` is one page for every seed. A path without a locale, such as the start URL, is answered offline with the page of the locale used last.
- Hashed static files, icons and the manifest: cache first.
- React Server Component payloads are never cached. They share a URL with the HTML, and serving one for the other would break the app. Offline, Next.js falls back to a full navigation, which the cached page answers.

Fonts are self-hosted under `/_next/static`, and audio is synthesized with Web Audio, so there are no extra files to cache. An e2e test loads the hub once, goes offline, reloads it, then opens one unseen seed per game and plays a move in each. Challenge rooms and the ranking need the network and are not cached.

`public/manifest.webmanifest` installs the platform as one app with a shortcut to each daily. `npm run icons` renders the PNGs from the SVG marks in `public/icons/`.

## Developer mode

Each game has a debug panel (seed, puzzle id, generator version, board size, solver and generation time, solution count, and a switch that shows the solution). The containers import it behind `process.env.NODE_ENV === "development"`, a build-time constant, so the bundler drops the module from production builds.

## No Web Worker

Generation runs in a zero-delay timeout after first paint, behind a loading board whose animation is a compositor-driven opacity change. Measured on a desktop: Patches stays under 100 ms up to 10x10. Zip needs a uniqueness proof for every board: mean 125 ms and worst case 430 ms for an 8x8 expert board over 300 boards. That is why Zip stops at 8x8 (9x9 took 1 to 5 seconds and 10x10 often failed). Queens has a p95 of 164 ms on expert, and Sumbreak a p95 of 84 ms. Wend and Termo take under a millisecond: Wend's uniqueness check visits about a hundred nodes, and Termo picks words from a list. Chess is the expensive one, because it plays whole games to find a puzzle: a mean of 267 ms on expert and a worst case of 1.3 s over 150 puzzles, which is why it stops at mate in 3. Every generator is a pure function of a serializable spec and can move into a worker unchanged if larger boards or longer mates are wanted.

## Commands

```
npm run dev
npm test                  Vitest: shared and every game
npm run test:e2e          Playwright: builds into .next-e2e, serves and drives the production app
npm run build
npm run typecheck
npm run lint
npm run icons             render PNG icons from public/icons/*.svg
npm run og                render the Open Graph images in public/og
npm run screenshots       play every game on a running server and save the README screenshots

npm run zip:generate -- --seed 12345 --difficulty hard [--size 8] [--solution] [--json]
npm run zip:validate -- [--count 100] [--from 2025-03-18 --days 365]
npm run zip:benchmark -- [--count 300] [--size 8]

npm run patches:generate -- --seed 12345 --difficulty hard [--size 8] [--solution] [--json]
npm run patches:solve -- --seed 12345 --difficulty hard [--steps]
npm run patches:validate -- [--count 200] [--from 2026-03-18 --days 365]
npm run patches:benchmark -- [--count 1000] [--size 10]

npm run chess:generate -- --seed 12345 --difficulty hard [--solution] [--json]
npm run chess:validate -- [--count 100] [--from 2026-11-22 --days 365]
npm run chess:benchmark -- [--count 200]

npm run queens:generate -- --seed 12345 --difficulty hard [--size 8] [--solution] [--steps] [--json]
npm run queens:validate -- [--count 100] [--from 2026-11-22 --days 365]
npm run queens:benchmark -- [--count 300] [--size 10]

npm run sumbreak:generate -- --seed 12345 --difficulty hard [--size 4] [--solution] [--json]
npm run sumbreak:validate -- [--count 100] [--from 2026-11-18 --days 365]
npm run sumbreak:benchmark -- [--count 300] [--size 4]

npm run wend:generate -- --seed 12345 --difficulty hard [--size 7] [--solution] [--json]
npm run wend:validate -- [--count 100] [--from 2026-06-09 --days 365]
npm run wend:benchmark -- [--count 200] [--size 7]

npm run termo:generate -- --seed 12345 --difficulty hard [--solution] [--json]
npm run termo:validate -- [--count 200] [--from 2026-11-22 --days 365]
npm run termo:benchmark -- [--count 2000]
npm run termo:words -- --data <folder with the fserb/pt-br files>
```

The browser tests build into `.next-e2e` (`NEXT_DIST_DIR`, read by `next.config.ts`), so a test run does not replace the files a running `next dev` serves from `.next`.

`PATCHES_BULK=500`, `ZIP_BULK=200`, `CHESS_BULK=100`, `QUEENS_BULK=200` and `SUMBREAK_BULK=300` raise the number of puzzles the bulk generation tests build per tier.
