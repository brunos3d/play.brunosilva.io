# Queens

Queens is a placement puzzle inspired by LinkedIn's Queens. This document covers its rules, solvers, generator and interaction. Platform features it shares with the other games (clock, hints, reveal, results, storage, offline) are in `docs/ARCHITECTURE.md`, and seeds and daily puzzles are in `docs/SEEDS.md`.

## Rules

The rules live in one file, `engine/rules.ts`.

1. Every row holds exactly one queen.
2. Every column holds exactly one queen.
3. Every coloured region holds exactly one queen.
4. Two queens never touch, diagonals included.

Rule 4 only bans neighbouring cells. Two queens can share a long diagonal, which is where the game departs from chess.

`checkQueen(topology, queens, cell)` returns null or the first rule a queen already on the board breaks with the new one, together with the clashing queen: `same-row`, `same-column`, `same-region`, `touching`. The rule is a code. `moveErrorText` in `engine/text.ts` turns it into the sentence the status line shows. `validateQueens` checks a whole set of queens from scratch and is the only completion check. `ruledOutCells` lists the cells that placed queens rule out, which the board draws as small dots.

## The original and what changed

LinkedIn's game uses the same four rules on boards from 7x7 to 11x11, with a new puzzle at midnight Pacific Time. A tap cycles a cell through empty, X and queen. Two settings help: one marks the cells a placed queen rules out, the other stripes queens that break a rule in red. Hint highlights a region or flags wrong placements, Undo takes back the last placement and Clear wipes the board. Sources: the [LinkedIn help page](https://www.linkedin.com/help/linkedin/answer/a6269510) and [Queens without backtracking](https://mspiegel.github.io/queens-without-backtracking/QUEENS.html), which also measured the board sizes of 668 archived puzzles.

This version differs in a few places, mostly to follow the platform rules:

- An illegal queen is refused instead of placed and striped. The board never holds a broken position, so a full board is a solved board.
- The dots for ruled-out cells are always on. They are derived from the queens, not stored, and look different from an X the player wrote.
- Dragging marks X's, and dragging from an X erases them.
- A hint acts. It removes a mistake, or plays the next deduction step and explains it.
- Boards go from 5x5 to 10x10. 11x11 was left out because a tile gets too small on a 360 px phone.
- Every board is generated on the device from a seed. There is no puzzle archive.

## Data model

```ts
type QueensPuzzle = {
  id: string; seed: string; version: number;
  size: number; difficulty: Difficulty;
  regions: number[];    // region id of every cell, row-major, ids 0 to size - 1
  solution: number[];   // the queen's cell in each row, top row first
  metadata: QueensMetadata;   // steps, maxLevel, score, levels, regionSizes, ...
};
```

`buildTopology(shape)` precomputes what the rules and solvers keep asking. `units` lists the regions, then the rows, then the columns, each with its cells. `attacks[cell]` is every cell a queen on `cell` rules out, and `attackMap` is the same relation as a flat byte array.

## Search solver

`solveQueens(shape, { maxSolutions, maxNodes })` in `engine/solver/search.ts` is a backtracking search, one row at a time. A queen needs a free column, a free region and a column at least two away from the queen in the row above. That last check is all "no touching" means between neighbouring rows. Columns are tried left to right, so the order of the solutions is fixed, and the search stops on a node budget, never on a clock.

It answers one question: how many solutions does this board have. The generator, the validator and the debug panel use it. A 10x10 board with one solution takes a few thousand nodes.

## Deduction solver

`engine/solver/logic.ts` solves a board the way a person does, one justified step at a time. The generator only ships boards it finishes, the difficulty score comes from its steps, and hints replay them.

Its state is a `Knowledge`: which cells are still free, which queens are placed and which groups are done. A group is a region, a row or a column. Placing a queen rules out its row, column, region and eight neighbours at once. That is part of placing, not a step.

`nextStep` returns the easiest step that applies:

| Level | Technique | Reasoning |
|---|---|---|
| 1 | `single` | A group has one free cell. The queen goes there |
| 2 | `confined-region` | Every free cell of a region is in one row or column. The rest of that line is out |
| 2 | `confined-line` | Every free cell of a row or column is in one region. The rest of that region is out |
| 3 | `blocker` | A queen on this cell would rule out every free cell of a group that has 2 left |
| 4 | `region-group`, `line-group` | 2 regions fit inside 2 lines, so other regions lose their cells there. Told from the other side: 2 lines only have free cells in 2 regions |
| 4 | `blocker` | The same as level 3 against a group with 3 or 4 free cells |
| 5 | `region-group`, `line-group` | The counting argument with 3 or more lines |
| 5 | `blocker` | Against a group with 5 or more free cells |
| 6 | `trial` | A queen on this cell forces a chain of singles that leaves some group without a cell |

The group technique looks at every subset of the open rows, then of the open columns. With at most 10 lines that is 1,022 subsets, each checked with a bit mask per region, so it costs little. A subset of k lines that holds k whole regions is the same fact as the other lines having free cells in only the other regions. The step is reported from the smaller side, because that is the one a person would spot.

Every step is sound, so a board the solver finishes has exactly one solution. The ladder follows the techniques described in [Queens without backtracking](https://mspiegel.github.io/queens-without-backtracking/HEURISTICS.html). The trial step is the last resort there too. No board in a 1,200 board benchmark needed it, but it stays in the ladder so that hints still work on a board a player has marked up in an unusual way.

`deduce` runs the ladder to the end and returns the steps, the hardest level and a score. The score is the weighted sum of the steps, with weights 0, 1, 3, 6, 10 and 16 for levels 1 to 6.

## Generator

`engine/generator/v1.ts`. The output depends only on the spec. Each attempt has its own PRNG stream, keyed by the seed and the attempt number.

1. **Queens first.** Place one queen per row and column with no two touching, by backtracking over shuffled columns. This is the solution.
2. **Grow the regions.** Every region starts as its queen's cell, so the board has one solution by construction. Each round picks a region in proportion to its appetite (a random weight per region, drawn from the tier's range) and offers it a free cell next to it. The cell is accepted only if no solution can put a queen on it, which a small backtracking search with that cell forced decides. More cells never remove a solution, so a refused pair of cell and region stays refused, and a board that gets covered still has exactly one solution.
3. **Get past dead ends.** Near the end some cell is usually refused by every region around it. Each refusal has a witness: the second solution that would appear. The generator moves another cell of that witness into a neighbouring region, which kills the witness, and accepts the move only if it opens no new solution itself and leaves the old region connected. The refused cell then gets another try. A board that cannot be rescued within 200 such trials is dropped.
4. **Require deduction.** The deduction solver must finish the board. One solution is not enough, because a board that needs a guess is not fair.
5. **Pick for the tier.** Steps 1 to 4 repeat until enough boards stay within the tier's hardest level, or until three times that many were built. The board whose score is closest to the tier's target wins.

An earlier version grew the regions freely and repaired uniqueness afterwards, by moving cells of extra solutions between regions. On 9x9 and 10x10 boards more than 90% of the attempts ran out of repairs, and a hard 9x9 took more than 300 ms at the median. Keeping uniqueness as an invariant during growth brought that to 21 ms.

`validateQueensPuzzle` audits a finished puzzle with code the generator does not use for its own proof: the regions are connected, the stored queens are legal, the search solver finds exactly that solution, and the deduction solver reaches it.

## Tiers

| Tier | Sizes | Candidates | Hardest level wanted | Target score per row | Smallest region |
|---|---|---|---|---|---|
| easy | 5, 6 | 3 | 2 | 0.3 | 1 |
| medium | 7 | 4 | 3 | 1 | 1 |
| hard | 8, 9 | 4 | 4 | 2.2 | 2 |
| expert | 9, 10 | 5 | 5 | highest | 2 |

The hardest level is a preference. A board above it only wins when nothing else was built, which happens when practice mode forces a large board on an easy tier. The smallest region applies from 7x7 up: a one-cell region gives a queen away, which suits easy boards and small ones. Easy and medium use a wide appetite range, which mixes small regions with large ones and makes the first steps easy to find.

Practice mode can force any size from 5x5 to 10x10 on any tier. Daily puzzles follow the shared weekly schedule, from easy on Monday to expert on Sunday, and puzzle #1 is 2026-11-22.

## Game state

`engine/game/state.ts`. Every function returns a new state. The board is one value per cell: empty, X or queen.

| Function | Behaviour |
|---|---|
| `cycleCell(topology, state, cell, skipQueen)` | one tap: empty, X, queen, empty. The step to queen can be refused, and then the same state comes back with the rule |
| `placeQueenAt(topology, state, cell)` | puts a queen on a cell, or refuses it. Decides completion with the full validator |
| `paintCell(state, cell, mode)` | one cell of a drag: `mark` writes an X on an empty cell, `erase` clears an X. Queens are never touched |
| `commitAction(state, marksBefore)` | closes an action: pushes the earlier board on the undo stack, counts one move, and one takeback per queen that left |
| `undoQueens(state)` | restores the board from before the last action |
| `resetQueens(state)` | clears the board and the undo stack, keeps the counters |
| `revealQueensStep(topology, solution, state)` | takes a wrong queen off, or places the next missing queen |

A drag is many cells but one action, so undo works drag by drag. "Takebacks" on the result screen counts the queens that left the board after being placed: by a third tap, by Undo or by a hint. The undo stack keeps the last 200 boards.

A cell that can never take a queen would keep its X forever if the cycle stopped at the refusal. So the tap after a refused one clears the X. The hook passes `skipQueen` for that tap.

## Hints

`getQueensHint(topology, solution, marks)` in `engine/hint.ts`:

1. A queen that is not part of the solution is flagged and taken off (`wrong-queen`).
2. An X on a cell that needs a queen is flagged and taken off (`wrong-mark`).
3. Otherwise the deduction solver looks at the board as the player left it. Placed queens and X's count as known. Its easiest step becomes the hint: `place` puts the queen on, `eliminate` writes X's on the cells the reasoning rules out.

The cells of the group are ringed on the board, and the cells the hint acts on get a dashed ring.

### The sentence

The hint is data. A `place` or `eliminate` hint carries a `reason`: the technique as a code and the groups it talks about, as kinds and indices.

```ts
{ code: "confined-region", region: 2, line: { kind: "row", index: 3 } }
{ code: "region-group", regions: [0, 4], lines: [{ kind: "column", index: 0 }, { kind: "column", index: 1 }] }
```

`hintText(t, hint, colorOf)` in `engine/text.ts` builds the sentence with a translator for the `queens` messages (see `docs/I18N.md`). The example above reads "Every free cell of the rose region is in row 4, so its queen takes that row. No other cell there can hold one." in English and "Todas as casas livres da região rosa estão na linha 4, então a rainha dela fica nessa linha. Nenhuma outra casa dali pode ter uma rainha." in Portuguese.

The engine does not know colours. `colorOf` is a function from a region to the translated name of its colour, and the board passes one built from its palette and the `color.*` messages. Without it a region is called by its number ("region 3"), which is what tests and tools get.

No sentence is glued together from the names of groups, because Portuguese needs the article, the preposition and the number to agree ("na linha 3", "da coluna 2", "as regiões rosa e lilás"). Each message under `hint.step` takes the kind of the group as an ICU `select` (`row`, `column`, `color` for a region with a colour, anything else for a region with a number) and phrases the whole clause. The group steps list several regions and lines. `hint.regionInList` phrases one region of such a list, and `list.and` joins the items with the language's conjunction.

A test follows hints from an empty board to the end on boards of every tier and checks three things: every placed queen is a solution cell, no eliminated cell is one, and the number of hints equals the number of steps the generator recorded.

## Interaction

- Tap a cell once for an X and again for a queen. A third tap clears it.
- Drag across cells to mark X's. A drag that starts on an X erases X's instead. A drag never changes a queen.
- A queen that breaks a rule is refused. The board shakes, the cell and the queen it clashes with are hatched, a sound plays and the status line names the rule in the player's language. The next tap on that cell clears its X.
- Cells a queen rules out show a small dot and fade a little. The player's own X is a cross, so the two never look alike.
- Regions are drawn as joined tiles in pastel fabric colours, the same family Patches uses, with an ink line on every border between two regions. Colour is never the only cue. Each region gets its own colour, chosen from the puzzle id so that look-alike colours rarely share a border.
- A solved board drops the X's and dots, and the crowns bow one row after another.
- Practice boards have a fifth control, New, that loads another board with a fresh seed and restarts the clock.
- Keyboard: arrows move a cursor, Enter or Space cycles the cell, Delete or Backspace clears it, Z undoes, H asks for a hint.
- Sound: an X ticks, a queen plays a tone that rises as the board fills, removing plays a low note and a refused queen buzzes.

The board is DOM like the other games: `role="gridcell"` tiles in the shared `mg-grid`, with one SVG layer for the region borders. The gesture lives in a ref and pointer handlers walk `getCoalescedEvents()`, for the reasons given in `docs/ARCHITECTURE.md`. An e2e test fires a whole drag inside one task.

## Storage

`storage/progress.ts` saves the board, the undo stack, the counters and the clock under `queens:<puzzle id>`. On load every stored board, the undo stack included, must have the right length, hold only known values and carry queens that break no rule. A board counts as solved only if `validateQueens` says so, and a solved board must carry a final time while an unfinished one must not. Anything else is dropped and the board starts fresh.

## Benchmark

`npm run queens:benchmark`, 300 boards per tier on a desktop machine, generator version 1:

| Tier | Generation p50 / p95 / max (ms) | Attempts | Deduction steps | Hardest level 1 / 2 / 3 / 4 / 5 / 6 | Score p10 / p50 / p90 |
|---|---|---|---|---|---|
| easy | 1.0 / 2.5 / 8 | 7.9 | 6.9 | 61 / 233 / 6 / 0 / 0 / 0 | 0 / 1 / 3 |
| medium | 2.4 / 4.5 / 6 | 9.4 | 11.6 | 0 / 29 / 271 / 0 / 0 / 0 | 5 / 7 / 9 |
| hard | 10 / 40 / 71 | 16.4 | 16.3 | 0 / 0 / 65 / 235 / 0 / 0 | 13 / 18 / 22 |
| expert | 40 / 164 / 308 | 22.0 | 20.9 | 0 / 0 / 0 / 94 / 206 / 0 | 31 / 46 / 63 |

No board was invalid and no two boards of a tier were the same.

Forcing 10x10 on every tier, 60 boards each:

| Tier | Generation p50 / p95 / max (ms) |
|---|---|
| easy | 65 / 125 / 145 |
| medium | 86 / 163 / 199 |
| hard | 123 / 267 / 293 |
| expert | 102 / 201 / 238 |

`npm run queens:validate` audits random seeds for every tier and size plus a run of dailies. A run with `--count 60 --days 120` checked 504 boards with 0 problems.

## Known weaknesses

- **The score is a proxy.** It counts how many hard steps the ladder needs, not how hard they are to see. A blocker against a two-cell region in a corner is easier to spot than the same step in the middle of the board, and both weigh the same.
- **One path is measured.** The solver always takes the easiest step, but a person may find a harder one first, or a shortcut the ladder does not know.
- **Large regions.** Growth by appetite sometimes gives one region a quarter of a 9x9 board. It keeps the board solvable but looks less tidy than a hand-made puzzle.
- **10x10 hard boards take about 120 ms** on a desktop and several times that on a slow phone. Generation runs behind the loading board.
- **No 11x11.** LinkedIn goes that far. Here the tile would fall under 30 px on a small phone.
