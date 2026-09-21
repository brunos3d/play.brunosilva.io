# Architecture

This repository is a small platform of daily logic puzzles. It currently holds two games, Zip and Patches, and is built so that a third one needs no changes to the first two. It is a Next.js 16 app (React 19, TypeScript strict, Tailwind 4) with no server state: every puzzle is generated in the browser and all progress stays on the device.

## Layout

```
src/
  proxy.ts                redirects the shortcut domains to the canonical one
  app/                    routes only, no logic
    page.tsx              hub
    zip/  patches/        daily (index), play (seeded), practice (setup)
    [difficulty]/[seed]/  redirect for old Zip links
  games/
    registry.ts           id, name, tagline, route and wording of every game
    zip/      engine/ components/ hooks/ storage/
    patches/  engine/ components/ hooks/ storage/
  shared/
    engine/               prng, seed codec, daily schedule, Pacific time, streak, clock, difficulty
    storage/              IndexedDB wrapper, settings, progress (boards, daily results, best times)
    platform/             audio, haptics, share, result builder, service worker registration
    hooks/                settings store, game clock, daily date, deferred generation
    ui/                   theme.css, icons, dialogs, header, controls, status line, result, practice setup, hub
public/                   sw.js, manifest.webmanifest, icons/
scripts/                  zip/, patches/, shared/ CLI tools, make-icons.ts
tests/                    shared/, zip/, patches/ (Vitest)
e2e/                      platform/, zip/, patches/ (Playwright, production build)
```

Dependencies point one way. A game imports `shared`, never another game. `shared` imports a game in exactly two places, both about listing games: `games/registry.ts` for names and routes, and the hub, which asks each game for today's daily info. Each `engine/` folder is pure TypeScript with no React, DOM or storage, which the CLI tools and unit tests prove by running it in plain Node.

The UI never decides a rule. A board turns pointer and key events into a rectangle (Patches) or a cell (Zip) and hands it to its hook, and the engine answers whether the move is legal, whether the puzzle is complete and what the next hint is.

## Adding a game

1. Add an entry to `games/registry.ts`.
2. Create `games/<id>/engine` with a seed codec (`createSeedCodec`), a generator, a daily config and a pure game state.
3. Write a hook that returns a `GameSession` (see below) and a board component.
4. Add `app/<id>/` with the three routes, an icon in `public/icons/` and in `shared/ui/game-icons.tsx`, and the routes to `PAGES` in `public/sw.js`.
5. Register today's daily info in the hub's `DAILY` table.

Header, controls, dialogs, results, streaks, best times, sharing, settings, the clock, sounds and offline support come from `shared`.

## The game frame

`shared/ui/game-frame.tsx` is everything around a board: header, status line, the four controls (Undo, Hint, Reveal, Reset), the tutorial slot, settings, the reveal confirmation, the result dialog, the Z and H shortcuts and the moment the clock starts. A game plugs in through one interface:

```ts
type GameSession = {
  ready: boolean; locked: boolean; elapsed: number; status: StatusMessage;
  hintsUsed: number; canUndo: boolean; canReset: boolean;
  summary: FinishSummary | null;   // set once the puzzle ends
  endedNow: boolean;               // false when a finished board is reopened
  begin(): void; undo(): void; reset(): void; requestHint(): void; reveal(): void;
};
```

`usePatchesGame` and `useZipGame` both return it. When `summary` appears, the frame calls `buildResult`, which records the daily result, the streak and the best time (or only reads them, when `endedNow` is false) and opens the result dialog. `GameView` components are mounted with `key={puzzle.id}`, so a new puzzle always starts from a clean hook.

## Platform rules shared by every game

- **Hints act, and they are counted.** A hint first looks for a mistake (a patch no solution contains, a path that left the solution), flags it and takes it off. Otherwise it plays the next forced move itself, with a one-sentence reason. Every generated puzzle has one proven solution, so a hint is never a guess.
- **Reveal** asks for confirmation, then plays the solution piece by piece. The puzzle ends as `revealed`: the day is closed, but it earns no streak credit, sets no best time and cannot be shared.
- **Reset** clears the board and the undo stack. The clock and the counters survive, so a reset cannot polish a result.
- **Illegal moves change nothing.** The board shakes, the offending cell or rectangle is hatched, a sound plays and the status line names the rule. Feedback never relies on colour alone.
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
| Daily results | `daily` | `<game>:<Pacific date>` |
| Best times | `stats` | `best:<game>:<difficulty>:<size>` |
| Sound, vibration, tutorials seen | localStorage `minigames:settings:v1` | |

Each game owns its snapshot format and treats stored data as untrusted. On load, Patches rebuilds every region and runs it through `validateRegion`, Zip walks the stored path through the move rules again, and a "solved" flag only survives if the full validator agrees. A finished board must carry a final time and an unfinished one must not. Anything off is dropped and the board starts fresh.

Boards are saved when the clock starts, after every move (in Zip after every gesture, not every cell) and when the puzzle ends. The first result of a date is the one that counts. Every IndexedDB call degrades to a no-op when storage is unavailable, so the games still play in a private window.

## Visual system

`shared/ui/theme.css` defines the tokens on `:root` (linen, ink, thread, accent, with a dark scheme), the page shell, buttons, dialogs, the status line and the tile board. The display face is Fraunces and the text face is Bricolage Grotesque, both self-hosted by `next/font`. Icons are hand-drawn SVG components in `shared/ui/icons.tsx`. No icon library is used.

Both boards are DOM, not canvas: `role="gridcell"` elements in a CSS grid with absolutely positioned layers on top, sized in percent. Every cell draws a rounded tile, and patches, previews, hints and visited Zip cells use the same `--tile-gap` and `--tile-radius`, which scale with the cell through container query units. The board width is rounded down with CSS `round()` to a whole number of pixels per cell, and the left margin is rounded too, because plain centring leaves half a pixel on each side whenever the leftover width is odd. E2e tests assert an integer grid origin and integer cell size at seven viewport sizes for both games.

Each game adds one stylesheet for what is unique to its board: `games/patches/components/patches.css` and `games/zip/components/zip.css`.

## Input

Both boards use Pointer Events, so mouse, touch and pen share one path, and both set `touch-action: none` so a drag never scrolls or zooms the page. Pinch zoom stays available outside the board.

Two lessons from Patches apply to both. The gesture lives in a ref and React state only mirrors it for rendering, because React batches `pointermove` updates and a handler that read the gesture from state could start from stale data. And handlers walk `getCoalescedEvents()`, because browsers merge fast moves into one event and the merged points are cells the finger really crossed. Each game has an e2e test that fires a whole drag inside one task, with no render in between.

Game-specific interaction is described in `docs/zip/ZIP.md` and `docs/patches/PATCHES_REFERENCE.md`.

## Domains

The platform lives at `play.brunosilva.io`, defined once as `SITE_ORIGIN` in `shared/platform/site.ts`. The root layout uses it for `metadataBase` and the canonical link.

`zip.brunosilva.io` and `patches.brunosilva.io` are shortcut domains. `src/proxy.ts` (the Next.js 16 name for middleware) redirects any request that arrives on one of them with a 308:

| Request | Goes to |
|---|---|
| `zip.brunosilva.io/` | `play.brunosilva.io/zip` |
| `patches.brunosilva.io/` | `play.brunosilva.io/patches` |
| `zip.brunosilva.io/practice` | `play.brunosilva.io/zip/practice` |
| `zip.brunosilva.io/play?seed=...` | `play.brunosilva.io/zip/play?seed=...` |
| `zip.brunosilva.io/hard/42` (old Zip link) | `play.brunosilva.io/hard/42`, which redirects again to `/zip/play` |

The rule is the pure function `resolveHostRedirect`, unit tested, and an e2e test drives the real proxy in the production server. The host is read from `x-forwarded-host` first, which is where Vercel's edge puts the public host. The target origin is a constant, so a forged header can only send a visitor to this site. Any other host (the canonical one, Vercel previews, localhost) is served normally. Adding a shortcut domain is one line in `GAME_HOSTS`.

All three domains have to be attached to the same Vercel project for the proxy to see the requests. Browser storage is per origin, so progress made on `zip.brunosilva.io` before the move does not follow the player to `play.brunosilva.io`.

## Open Graph images

The hub and each game have their own 1200x630 image: `public/og/home.png`, `zip.png` and `patches.png`. They are static files, rendered once by `npm run og` and committed, so nothing is generated per request or per build. The script lays out an HTML card (title and tagline on the left, the game's icon on the right) with the site's fonts and the SVG marks from `public/icons`, and takes a screenshot with Playwright's Chromium. Texts come from `games/registry.ts`, so the images are re-rendered only when a name, a tagline or an icon changes.

A child route segment replaces its parent's `openGraph` metadata as a whole, so each game layout repeats every field. An e2e test checks the tags on all three pages and reads the PNG header of each file to confirm its size.

## PWA and offline

`public/sw.js` is registered in production with scope `/`.

- Install: fetch the seven pages, cache them, then cache every `/_next/static/...` URL found in their HTML. This covers the first visit, when the page loaded before the worker could see its requests.
- Navigations: network first, cached page as fallback. The query string is ignored on fallback, because `/zip/play?seed=...` is one page for every seed.
- Hashed static files, icons and the manifest: cache first.
- React Server Component payloads are never cached. They share a URL with the HTML, and serving one for the other would break the app. Offline, Next.js falls back to a full navigation, which the cached page answers.

Fonts are self-hosted under `/_next/static`, and audio is synthesized with Web Audio, so there are no extra files to cache. An e2e test loads the hub once, goes offline, reloads it, then opens one unseen seed per game and plays a move in each.

`public/manifest.webmanifest` installs the platform as one app with shortcuts to both dailies. `npm run icons` renders the PNGs from the SVG marks in `public/icons/`.

## Developer mode

Each game has a debug panel (seed, puzzle id, generator version, board size, solver and generation time, solution count, and a switch that outlines the solution). The containers import it behind `process.env.NODE_ENV === "development"`, a build-time constant, so the bundler drops the module from production builds.

## No Web Worker

Generation runs in a zero-delay timeout after first paint, behind a loading board whose animation is a compositor-driven opacity change. Measured on a desktop: Patches stays under 100 ms up to 10x10. Zip is the expensive one, because every board needs a uniqueness proof: mean 125 ms and worst case 430 ms for an 8x8 expert board over 300 boards. That is why Zip stops at 8x8 (9x9 took 1 to 5 seconds and 10x10 often failed). Both generators are pure functions of a serializable spec and can move into a worker unchanged if larger boards are wanted.

## Commands

```
npm run dev
npm test                  Vitest: shared, zip and patches
npm run test:e2e          Playwright: builds, serves and drives the production app
npm run build
npm run typecheck
npm run lint
npm run icons             render PNG icons from public/icons/*.svg
npm run og                render the Open Graph images in public/og
npm run screenshots       play both games on a running server and save the README screenshots

npm run zip:generate -- --seed 12345 --difficulty hard [--size 8] [--solution] [--json]
npm run zip:validate -- [--count 100] [--from 2025-03-18 --days 365]
npm run zip:benchmark -- [--count 300] [--size 8]

npm run patches:generate -- --seed 12345 --difficulty hard [--size 8] [--solution] [--json]
npm run patches:solve -- --seed 12345 --difficulty hard [--steps]
npm run patches:validate -- [--count 200] [--from 2026-03-18 --days 365]
npm run patches:benchmark -- [--count 1000] [--size 10]
```

`PATCHES_BULK=500` and `ZIP_BULK=200` raise the number of puzzles the bulk generation tests build per tier.
