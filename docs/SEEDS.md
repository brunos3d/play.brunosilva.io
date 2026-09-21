# Seeds and daily puzzles

Every game on the platform uses the same seed format, the same PRNG and the same daily rules. The shared code is in `src/shared/engine`: `prng.ts`, `seed-codec.ts`, `daily.ts`, `pacific-time.ts` and `streak.ts`.

## Guarantee

The same seed, difficulty, size and generator version always produce the same puzzle, on any machine and in any JavaScript engine.

```ts
generatePuzzle("example-seed", "hard");      // Patches, identical every time
generateZipPuzzle("example-seed", "hard");   // Zip, identical every time
```

No generator reads `Math.random()`, `Date.now()`, UUIDs, storage order or the network. `getDailyPuzzle(new Date())` reads the clock only to decide which date to build, and the date then acts as an ordinary seed.

Zip's old generator broke this rule. Its uniqueness check ran the solver under a time limit, so a slow phone gave up sooner and the same seed could grow different walls there. The new solver works on a node budget, which is the same on every machine. A test runs a budget-limited search twice and requires identical results.

## PRNG

- **cyrb128** hashes any string into four 32-bit words.
- **sfc32** (Small Fast Counter) turns those words into a stream. It has 128 bits of state, passes PractRand, and uses only 32-bit integer operations, so every engine produces the same sequence.

Mulberry32, which the old Zip used, was not kept. Its 32-bit state limits the number of distinct streams and it fails statistical tests sooner.

`createRng(seed)` returns `next`, `int`, `range`, `chance`, `pick`, `weighted` and `shuffle`. Snapshot tests pin the first outputs for a known seed and the fingerprint of one known puzzle per game, so an accidental change to the stream or to a generator fails CI.

## Seed format

```
<GAME>:<token>:<version>:<difficulty>[:<size>]

ZIP:2026-09-21:1:easy          a daily Zip
PATCHES:2026-09-21:1:hard      a daily Patches
ZIP:lucky:1:hard:8             practice, forced to 8x8
```

| Field | Rules |
|---|---|
| game | `ZIP` or `PATCHES`. A seed of one game is rejected by the other |
| `token` | letters, digits, `.`, `_`, `-`. Up to 64 characters. Free text is normalized: `"hello world"` becomes `hello-world` |
| `version` | generator version, an integer |
| `difficulty` | `easy`, `medium`, `hard`, `expert` |
| `size` | optional. Zip 5 to 8, Patches 5 to 10. Without it the tier picks the size |

Each game builds its codec with `createSeedCodec({ prefix, currentVersion, supportedVersions, minSize, maxSize })`. The PRNG key is `<GAME>|v<version>|<token>|<difficulty>|<size or auto>`, so every field that changes the puzzle is in the key and two games never share a stream.

## Versioning

Each game has its own generator version (`GENERATOR_VERSION`, `ZIP_GENERATOR_VERSION`), both currently 1. When a generator change would alter the board a seed produces:

1. Keep the old code path.
2. Bump the version.
3. Add the new number to the codec's `supportedVersions`.

Old links and old dailies then keep their boards. A seed with an unsupported version throws, and the play page shows "This seed cannot be played".

## Share URLs

```
/zip/play?seed=ZIP%3Ashare-me%3A1%3Ahard%3A8
/patches/play?seed=PATCHES%3Ashare-me%3A1%3Ahard%3A8
```

The canonical seed carries token, version, difficulty and size, so the URL alone rebuilds the exact puzzle. Hand-typed links also work: `/zip/play?seed=12345&difficulty=expert&size=7`. Missing or invalid parts fall back to `medium`, automatic size and the current version. E2e tests open the same URL in two separate browser contexts and compare every cell.

The practice page creates random tokens with `crypto.getRandomValues`. That is the only randomness outside the engines. It chooses which puzzle to play and never shapes one.

Old Zip links such as `/hard/42` redirect to `/zip/play?seed=42&difficulty=hard`. The board is not the one the old link showed: the old generator depended on a time limit and cannot be reproduced.

## Daily puzzles

The canonical date is the calendar date in `America/Los_Angeles`, read through `Intl.DateTimeFormat`. The browser's timezone is never used. Dates travel as `YYYY-MM-DD` strings.

```
daily seed = <GAME>:<YYYY-MM-DD>:<version>:<difficulty of that weekday>
number     = days since the game's epoch, plus 1
```

| Game | Epoch (puzzle #1) | 2026-09-21 is |
|---|---|---|
| Zip | 2025-03-18, the day the original Zip launched | #553 |
| Patches | 2026-03-18, the day the original Patches launched | #188 |

Both launch dates come from press coverage. The numbers were not checked against the counters LinkedIn shows in its own games.

Both games share one weekly ramp (`DEFAULT_WEEKLY_SCHEDULE`): Monday easy, Tuesday easy or medium, Wednesday medium, Thursday medium or hard, Friday and Saturday hard, Sunday expert. On mixed days the date picks the tier through the seeded PRNG, per game, so every player gets the same one.

Rollover happens at midnight Pacific. `msUntilPacificMidnight` first estimates from wall-clock parts, then corrects against the real date boundary, because the estimate is an hour off on the 23-hour and 25-hour days when daylight saving changes. Tests cover both days and check 400 instants across a year.

When midnight passes with a game open, the page offers the new puzzle in a banner. It does not swap the board, so an unfinished puzzle is never taken away mid-solve. The hub shows a countdown to the next boards.

## Streaks

`computeStreak(completedDates, today)` works on Pacific date keys, per game. The current streak counts the run that ends today or yesterday, so it stays alive while today's puzzle is unsolved and drops to 0 once a day is missed. A day whose solution was revealed is stored, which closes the day, but it does not count toward the streak. Practice puzzles never touch it.
