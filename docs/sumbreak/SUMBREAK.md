# Sumbreak

Sumbreak is a merging puzzle inspired by LinkedIn's Sumbreak, which launched on 18 November 2026. This document covers what the original does, the rules, the solver, the generator and the interaction. Platform features it shares with the other games (clock, hints, reveal, results, storage, offline) are in `docs/ARCHITECTURE.md`, and seeds and daily puzzles are in `docs/SEEDS.md`.

## The original

These notes were taken in the game's first week. Facts marked "live game" were read from LinkedIn's own page, played as a guest. The rest comes from the linked articles.

- **Launch.** Sumbreak is LinkedIn's ninth game and its first numbers game. It went live at midnight Pacific Time on 18 November 2026 ([Social Media Today](https://socialmediatoday.com/news/linkedin-adds-ninth-in-stream-game/875119), [Beebom](https://beebom.com/puzzle/linkedin-sumbreak-math-logic-game-launched/)). It can be played without an account at `linkedin.com/games/sumbreak`.
- **Rules.** The start screen says "Combine the identical numbers". LinkedIn's instructions, as quoted by a [developer who tested it as a guest](https://github.com/Petkomat/linkedin-games/issues/13): "Drag to combine matching neighbor cells. Repeat until one cell remains." Two equal side neighbours become one tile with their sum. The sum stays on the cell that was dropped on, the other cell is left empty, nothing slides, and a merge never reaches across an empty cell ([awa.games](https://awa.games/linkedin-games/sumbreak/howto/), same GitHub issue).
- **Boards (live game).** Puzzle #1 was 3x3 and puzzle #5, a Sunday, was 4x4. Both started full, with powers of two only, and the last tile is their sum: 128 and 1024.

  ```
  #1                 #5
  1  1 64            1  1  1 512
  4  2 32            1  4  1 256
  4  4 16            2  8  1 128
                     4  8 32  64
  ```

- **Messages (live game).** "The numbers have to be identical", "Oops! No more combinations are possible" and "We took the board back to your last correct move. Keep trying!". So the game knows which positions can still be finished, and says nothing until the player is stuck or asks.
- **Controls (live game).** Undo and Hint under the board, plus Tutorial, Reset and Settings in the header, and a timer. A hint names the two cells to merge: "Merge row 1, column 1 with row 2, column 1". Clicking one tile and then the other merges like a drag does (GitHub issue).
- **Unverified.** One site describes wildcard tiles such as "+3" and "x2" ([awa.games](https://awa.games/linkedin-games/sumbreak/howto/)). The two boards seen on the live game had none, and the tester in the GitHub issue found none either. This version has no wildcards.

The two LinkedIn boards above are used as solver test data in `tests/sumbreak/engine.test.ts`. They are never served as puzzles: every board here is generated.

## Rules

The rules live in one file, `engine/rules.ts`.

1. A tile merges with a tile that holds the same number.
2. The two tiles must be side neighbours. Diagonals do not count.
3. The tile that was dropped on keeps its place and holds the sum. The other cell is left empty.
4. Nothing slides. A tile never moves into an empty cell and never reaches across one.
5. The puzzle is solved when one tile is left.

`checkMerge(size, cells, merge)` returns null or the rule that refuses the merge, as a code: `different`, `not-adjacent`, `empty-target`, `empty-source`. `different` also carries the two numbers. `mergeErrorText` in `engine/text.ts` turns the code into the sentence the status line shows. `isStuck` is true when more than one tile is left and no merge is legal.

Rule 3 is what makes it a puzzle. Merging A onto B and B onto A give the same number in different places, and only one of them may leave it next to its next partner.

## Data model

```ts
type SumbreakPuzzle = {
  id: string; seed: string; version: number; difficulty: Difficulty;
  size: number;
  cells: number[];      // row-major, 0 for an empty cell
  total: number;        // the last tile: the sum of all tiles
  solution: Merge[];    // one order that works: { from, to } cell indices
  metadata: SumbreakMetadata;   // winChance, openingMoves, attempts, solverNodes
};
```

## One solution, or many

Zip, Patches and Queens promise one solution. Sumbreak cannot: two merges in different corners of the board can be played in either order, so almost every board has many winning orders. What the engine guarantees instead:

- every generated board can be finished, by construction and checked again by the solver,
- for any position a player can reach, the solver knows whether it can still be finished.

The second point is what drives hints, the count of missteps and the reveal.

## Solver

`SumbreakSolver` answers "can this position still be finished" and returns one order of merges that does it.

One observation makes the search small. The smallest number on the board can only merge with itself, and a merge of larger numbers never helps it: tiles do not move, so emptying a cell elsewhere cannot bring two small tiles together. Any solution can therefore be reordered so that the smallest numbers merge first. The solver only ever tries merges of the smallest number present, and that is still a complete search. A test compares it with a brute-force search over every legal merge on 150 random boards.

Three facts cut dead positions without searching (`quickDeadReason`):

- `odd-count`: the smallest number needs an even count, since its tiles pair up,
- `split`: the tiles must form one connected group, since two groups can never meet,
- `lonely`: every tile of the smallest number needs an equal neighbour now.

Dead positions are remembered, and the budget is a node count, never a clock. LinkedIn's 4x4 board is solved in 16 nodes.

## Difficulty

`winChance` is the measure. It is the chance that a careful but aimless player ends with one tile: at every step the player picks evenly among the merges of the smallest number, leaving out the ones whose result is dead at a glance. What is left are the traps that take thought to see.

Plain random play was tried first and measures nothing: with two directions per merge it gives 1 in 128 for LinkedIn's first board, which has only one real decision. Leaving out the merges that are obviously dead gives 0.50 for LinkedIn's first 3x3 and 0.05 for its first 4x4, which matches how they play.

| Tier | Sizes | Target | Measured p10 / p50 / p90 |
|---|---|---|---|
| easy | 3x3 | 0.55 | 0.44 / 0.50 / 0.66 |
| medium | 3x3, 4x4 | 0.17 | 0.14 / 0.18 / 0.22 |
| hard | 4x4 | 0.045 | 0.035 / 0.047 / 0.061 |
| expert | 4x4, 5x5 | 0.012 | 0.008 / 0.013 / 0.019 |

## Generator

`generateSumbreakFromSpec(spec)` builds the puzzle for a seed. It is a pure function of the spec: the PRNG is keyed by token, version, difficulty and size, and every candidate board has its own stream.

**Building backwards** (`buildBackwards`). The builder starts from the single tile a solved board ends with, a power of two, and keeps breaking a tile in two: the tile keeps half, and the other half lands on an empty cell beside it. Played in reverse, every break is a merge, so the board can be finished by construction and the reversed list of breaks is the stored solution. It stops when the board is full, as LinkedIn's boards are.

Two numbers shape a board:

- The **exponent** of the last tile: 16 to 256 on 3x3, 256 to 1024 on 4x4, 1024 to 4096 on 5x5. A lower total on the same board means more small equal tiles.
- The **spread**, which leans the choice of which tile to break. Favouring large tiles gives many equal small numbers and many ways to go wrong. Favouring small ones leaves a chain of large tiles that almost merges by itself.

**Choosing a board.** The generator builds up to 12 to 24 candidates, measures each with `winChance`, and keeps the one closest to the tier's target on a log scale. A candidate within the tier's tolerance is taken at once.

### Benchmark

300 boards per tier on a desktop (`npm run sumbreak:benchmark`):

| Tier | Mean | p95 | Max |
|---|---|---|---|
| easy | 0.3 ms | 0.8 | 3.5 |
| medium | 2.3 ms | 10 | 79 |
| hard | 2.3 ms | 7.5 | 24 |
| expert | 22 ms | 84 | 546 |

No board was invalid. Hard and expert boards never repeated. About one easy board in five and one medium board in ten did: a 3x3 board that ends on 16 to 256 does not leave many arrangements.

## Playing

- **Merging.** Drag a tile onto a neighbour, or tap the tile to move and then the tile to drop it on. The sum always lands on the second one. A dragged tile follows the pointer along one axis, no further than the next cell, and counts as dropped once it is 35% of the way there.
- **Illegal merges change nothing.** The board shakes, the target is hatched and the status line names the rule.
- **Missteps.** A legal merge is always played, even when it leaves a board that cannot be finished. The player is not told at the time, as on LinkedIn. `brokenAt` remembers the last good position, and the result screen counts each such merge under "Missteps".
- **Stuck.** With no merge left the tiles lose their colour and the status line says so.
- **Hint.** On a board that can no longer be finished, the hint names what went wrong (an odd count, a stranded tile, two groups, or a dead end only search can see) and takes the board back to the last position that can be finished. Otherwise it points at the next merge, says how many of the ways to merge the smallest number were safe, and plays it.
- **Text.** The engine holds no sentences. `getSumbreakHint` returns data: for a merge the number, its row and column, the direction of the drop and the counts of safe ways, and for a dead end the reason, the smallest number and how many tiles hold it. `hintText` in `engine/text.ts` builds the sentence with a translator for the `sumbreak` messages (see `docs/I18N.md`). A tile's number goes into a message as text, so 1024 is never written "1,024".
- **Undo** takes back one merge. **Reset** returns to the starting board. **Reveal** goes back to the last good position if needed and plays a solution.
- **Keyboard.** Arrow keys move a cursor, Enter picks up a tile and Enter on a neighbour drops it there.

Tiles keep an identity between positions, so a merge is one tile sliding into another and the other one growing. Tile colours are pastel in both themes, one per power of two, and the number is always printed.

## Storage

The snapshot stores the list of merges, the counters and the clock. On load every merge is played again through the rules, the point where the board stopped being solvable is worked out again by the solver, and a board only counts as solved if one tile is left.

## Tools

```
npm run sumbreak:generate -- --seed 12345 --difficulty hard [--size 4] [--solution] [--json]
npm run sumbreak:validate -- [--count 100] [--from 2026-11-18 --days 365]
npm run sumbreak:benchmark -- [--count 300] [--size 4]
```

`SUMBREAK_BULK=300` raises the number of boards the bulk generation test builds per tier.
