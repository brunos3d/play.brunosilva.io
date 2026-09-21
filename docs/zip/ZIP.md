# Zip

Zip is a path puzzle inspired by LinkedIn's Zip. This document covers its rules, engine, generator and interaction. Platform features it shares with Patches (clock, hints, reveal, results, storage, offline) are in `docs/ARCHITECTURE.md`, and seeds and daily puzzles are in `docs/SEEDS.md`.

## Rules

The rules live in one file, `engine/rules.ts`.

1. The path starts on 1.
2. Each step goes to a side neighbour. Diagonals do not connect.
3. The path never crosses a wall and never enters a blocked cell.
4. The path never visits a cell twice.
5. Numbered cells are passed in order: 1, 2, 3 and so on.
6. The puzzle is solved when the path covers every cell that is not blocked and ends on the last number.

`checkStep(topology, path, cell)` returns null or the rule that refuses the step, with a sentence for the UI: `start-at-one`, `blocked`, `not-adjacent`, `wall`, `revisit`, `wrong-number`, `path-ended`. `validatePath` walks a whole path through `checkStep` again and is the only completion check. `stepTo` calls it when the path reaches full length, so a full board that ends on the wrong cell is not accepted.

Reaching the last number early is allowed: the path then cannot grow, the uncovered cells pulse, and the status line says how many are left.

### Hidden numbers

On hard and expert boards some numbers show `?`. The player sees that the cell is numbered but not which number it is. 1 and the last number are never hidden, and at least one number in between stays visible.

Rule 5 is therefore checked by position. A visible number n must be the nth numbered cell on the path. A hidden number fits any position: the player cannot know its value, and refusing the step would give it away. The generator only hides a number while the board keeps exactly one solution under this looser rule, so the rules and the solver share the same definition (`nextNumber` counts numbered cells on the path, it does not read them).

Once the path covers a `?`, the cell shows the place it takes on that path. That is its real number only if the path is right, so nothing leaks. The pulsing ring that marks the next number never appears on a hidden one.

### Blocked cells

A blocked cell is a hole in the board: a dashed outline with a cross. It has no neighbours, the path cannot enter it, and it does not have to be covered. `Topology.playableCount` is the number of cells a solution covers.

## Data model

```ts
type ZipPuzzle = {
  id: string; seed: string; version: number;
  width: number; height: number; difficulty: Difficulty;
  checkpoints: { number: number; row: number; column: number; hidden?: boolean }[];
  walls: { a: number; b: number }[];   // cell indices, a < b, side neighbours
  blocked: number[];                   // cell indices the path cannot enter
  solution: number[];                  // row-major cell indices, in path order
  metadata: ZipMetadata;               // theme, trapScore, hiddenCount, blockedCount, ...
};
```

`buildTopology(shape)` precomputes what the rules keep asking: passable neighbours per cell with walls and blocked cells already removed, the number on each cell and whether it is hidden, and the start and end cells.

## Solver

`solveZip(shape, { maxSolutions, maxNodes, prefix })` is a backtracking search for Hamiltonian paths that take the numbers in order and end on the last one. It works on typed arrays and prunes three ways:

- every unvisited cell must still be reachable from the head (one flood fill per node),
- every unvisited cell needs a way in and a way out, and the end cell a way in,
- the last number may only be entered as the final step.

Neighbours are tried fewest-exits-first (Warnsdorff).

The solver keeps a counter of numbered cells on the path, the same way the rules do. A visible number must match the counter, a hidden one always fits. Blocked cells never enter the search, and a solution is `playableCount` cells long.

The search budget is a node count. The earlier solver used a time limit (`Date.now()`), which expires sooner on a slow phone, so the same seed could end up with different walls on different devices. That is not acceptable for a daily puzzle that must be the same for everyone. `unique` is true only with exactly one solution and a search that ran to the end.

## Generator

The generator is versioned (`engine/generator/`). `v1.ts` is frozen: old seeds and past dailies keep their boards. `v2.ts` is the current one. `docs/SEEDS.md` explains how versions and dailies relate.

### Version 1

A random Hamiltonian path by backbiting (forty moves per cell), numbers spread evenly along it, then walls: the solver is asked for two solutions, and one edge that the impostor uses and the real path does not becomes a wall, until the solution is unique. A last pass drops walls that turn out not to be needed.

It worked, but every board looked the same. The path was uniform noise, the walls were isolated segments with no relation to each other, the numbers were evenly spaced, and the only thing a tier changed was how many numbers there were. Expert on 8x8 was easy.

### Version 2

Each attempt has its own PRNG stream and goes through these steps.

1. **Theme.** The seed picks a figure, with odds per tier (`figures.ts`):
   - wall figures: `cross`, `frame`, `corners`, `corridors`, `slash`, `face`, `pinwheel`, `mirror`,
   - blocked cells: `core` (the middle of the board), `pillars` (single cells placed symmetrically), `islands` (dominoes with their mirror image or half turn),
   - or `none`, where a drawn path carries the theme.

   Every figure is turned a random way. Blocked cells must leave the two colours of the checkerboard level, give or take one, or no path exists. A domino always takes one cell of each colour, and single cells are picked by colour.
2. **Path.** Three ways (`paths.ts`):
   - Around a figure: `findHamiltonianPath` searches the walled board depth first, fewest exits first, which hugs the figure. Six backbite moves per cell hide the search order and keep the look.
   - On an open board: a `spiral`, a `snake` or a generalised Hilbert curve, disturbed by a few backbite moves (each move changes one edge of the drawing), or `random`, which is noise as in version 1.
   - Symmetric: on a symmetric board the solution itself can be symmetric, with odds per tier. See below.
3. **Numbers.** 1 and the last number sit on the ends of the path. The stretches between numbers vary in length by the tier's `gapVariance`, so a board is not n equal chores.
4. **Uniqueness.** The solver is asked for two solutions. With `numbers-first`, the generator adds a number on a cell that the impostor visits in a different stretch than the real path does, which rules the impostor out. A number says nothing about the next turn, so it keeps a board hard where a wall would give a turn away, and it halves the wall count. When no such cell exists or the number budget is spent, an edge that only the impostor uses becomes a wall, together with its twin under the theme's symmetry. A last pass drops wall groups that are not needed. Figure walls are never touched.
5. **Numbers for walls.** With the tier's `wallsFirstOdds` a board starts with 70% of the usual numbers and is made unique with walls alone. One tier therefore offers both kinds of board: many numbers and few walls, or few numbers and many walls.
6. **Candidates.** Steps 1 to 5 run until the tier has its number of candidates. The generator keeps the one whose trap score is closest to the tier's target.
7. **Hidden numbers.** On the chosen board, numbers between 1 and the last one are hidden one at a time, in random order, up to the tier's share. Each one stays hidden only if the solver still finds exactly one solution. This runs on the chosen board only, because every trial is a full uniqueness proof.

If uniqueness cannot be proven within 40,000 nodes, or the board needs more walls than the tier allows, the attempt is dropped. Up to 40 attempts run.

### Symmetric solutions

`symmetricPath` builds a Hamiltonian path whose second half is the image of the first, walked backwards. Such a path has a middle. Under a mirror the two middle cells face each other across the axis, which needs an even size. Under a half turn the middle is the centre cell, which needs an odd size.

Every other cell comes in a pair with its image, and a symmetric path visits one cell of each pair before the middle and the other one after it. So the first half is a Hamiltonian path of the quotient graph, whose nodes are the pairs, ending on a pair next to the middle. The generator finds that path, mixes it by backbiting with the end pinned, and lifts it back to cells. At each step either cell of the next pair may be the one that continues the path, which lets the solution cross the axis as often as it likes.

With little mixing, the half keeps the wall-hugging look of the search. On an odd board that reads as a spiral in and the same spiral out. Walls and blocked cells must map onto themselves, so a symmetric solution also works on symmetric figures such as `cross`, `corners` or `core`. Extra walls then follow the solution's symmetry.

### Difficulty

`measureTraps` (`generator/difficulty.ts`) walks the solution. At every cell it tries each legal wrong turn and asks the solver to refute it, with a cap of 300 nodes. A wrong turn that dies within 3 nodes is obvious and scores nothing. Up to 40 nodes it is a shallow trap (1 point), beyond that a deep trap (3 points), and one that survives the cap scores 5. The sum is the trap score: how many times the board invites a mistake that only shows later.

The score is what made the tiers real. Measured on 8x8 boards, corridors and the pinwheel force almost the whole path (median 1 and 6), while a lightly disturbed snake or spiral on an open board is the hardest kind (median 89 and 52, against 23 for the noise of version 1). So the easy tier favours the first group, expert the second, and every tier aims for a target score.

`validateZipPuzzle` audits a finished puzzle independently with a ten times larger budget: numbers are 1..n, the solver finds exactly one solution, and it is the stored one.

## Tiers

`engine/config.ts`, version 2.

| Tier | Sizes | Numbers, share of cells | Hidden numbers | Candidates | Target trap score |
|---|---|---|---|---|---|
| easy | 5x5, 6x6 | 16% to 22% | none | 2 | 0 |
| medium | 6x6, 7x7 | 12% to 16% | none | 3 | 14 |
| hard | 7x7, 8x8 | 8.5% to 11.5% | 25% to 40% | 3 | 28, before hiding |
| expert | 7x7, 8x8 | 6.5% to 9% | 40% to 60% | 5 | the highest |

Every tier gives a symmetric solution a 30% chance, and trades numbers for walls on 25% to 30% of its boards. Practice mode can force any size from 5x5 to 8x8 on any tier.

## Game state

`engine/game/state.ts`. Every function returns a new state.

| Function | Behaviour |
|---|---|
| `stepTo(topology, state, cell)` | moves the head. Stepping onto the previous cell takes the last step back. A refused step returns the same state plus the rule |
| `truncateTo(state, cell)` | cuts the path so that it ends on `cell` |
| `commitGesture(state, pathBefore)` | closes a gesture: pushes the earlier path on the undo stack, counts one move, and one backtrack if cells were taken back |
| `undoZip(state)` | restores the path from before the last gesture |
| `resetZip(state)` | clears the path and the undo stack, keeps the counters |
| `revealZipStep(solution, state)` | cuts the path back to where it still follows the solution, then grows it one cell per call |

A drag is many steps but one move, so undo works gesture by gesture. "Backtracks" on the result screen counts the gestures that took cells back, by dragging backwards, tapping the path or Undo.

## Hints

`getZipHint` compares the path with the unique solution. If the path left it, the hint is `wrong-turn`: the wrong stretch is hatched for a moment and then cut off, with a message such as "The path goes wrong right after 2". Otherwise it is `extend`: the game draws the path to the next numbered cell, hidden or not, cell by cell.

## Interaction

- Press 1 and drag. Pressing the head continues from it, and pressing a neighbour of the head extends to it.
- Dragging back onto one of the last three cells rewinds to it. Farther back needs a tap, so a stray touch cannot wipe a long path. A tap anywhere on the path cuts it there, and the same drag can continue from that cell.
- A fast drag that skips cells still works: a target in the same row or column is reached by walking every cell in between, and a diagonal neighbour by trying both corners. Walking stops at the first refused step.
- A refused step shakes the board, hatches the cell, plays a sound and names the rule. A finger resting on a forbidden cell complains once, not on every pointer event.
- A tap on a cell the path cannot reach (not in line with the head, not a diagonal neighbour) is refused the same way. The same cell crossed during a drag stays silent, or a fast diagonal swipe would buzz all the way.
- The next number wears a pulsing ring, and the head of the path has a marker that shows where to press.
- A solved board keeps only its answer. The walls and the numbers fade out and the line gets thicker, so what stays is the drawing the path makes. A board that loads already solved appears in that state.
- Practice boards have a fifth control, New, that loads another board with a fresh seed and restarts the clock.
- Keyboard: arrows move the head (the first key puts the path on 1), Backspace takes a step back, Z undoes, H asks for a hint.
- Sound: each step plays a short tone whose pitch rises an octave as the path fills the board, numbers chime, stepping back plays a low note, and a refused step buzzes.

The path is drawn in SVG over the tiles. Its colour runs continuously from one fabric colour to another: each segment is a gradient between its two cells' colours, and a disc in the exact vertex colour closes every joint. Flat-coloured segments with round caps left a darker blob wherever two of them overlapped. The line colour is the tile's own hue made darker and more saturated with CSS relative colour syntax, because mixing a pastel with ink gives a muddy brown.

## Benchmark

`npm run zip:benchmark`, 300 boards per tier on a desktop machine, generator version 2:

| Tier | Generation p50 / p95 / max (ms) | Numbers (hidden) | Walls | Boards with blocked cells | Symmetric solutions | Trap score p10 / p50 / p90 |
|---|---|---|---|---|---|---|
| easy | 0.9 / 2.7 / 13 | 6.0 (0) | 5.1 | 50 | 54 | 0 / 1 / 4 |
| medium | 6.2 / 46 / 115 | 7.6 (0) | 6.3 | 60 | 61 | 6 / 12 / 17 |
| hard | 61 / 258 / 400 | 8.9 (2.3) | 8.2 | 78 | 64 | 18 / 30 / 48 |
| expert | 178 / 678 / 1103 | 9.2 (3.3) | 6.3 | 49 | 68 | 27 / 49 / 74 |

No board was invalid. For comparison, version 1 expert boards average a trap score of 34 on 8x8, and version 2 averages 52 there.

`npm run zip:validate` audits 925 boards, 365 consecutive dailies among them, with 0 problems.

## Known weaknesses

- **Board size stops at 8x8.** Proving uniqueness is exponential. 9x9 took 1 to 5 seconds per board and 10x10 failed a third of the time, so they were left out instead of shipped slow. A Web Worker and a stronger solver would lift this.
- **Expert generation can take a second** on a desktop for an 8x8 board, and several times that on a slow phone. It builds five candidates and proves each hidden number. It runs behind a loading board.
- **Repeated paths on small easy boards.** 24 of 300 easy boards shared their path with another board. Corridors and the pinwheel leave a 5x5 grid very few paths. Numbers and walls still differ.
- **The trap score is a proxy.** It measures how long a wrong turn survives a solver, not how a person reasons. A symmetric solution, once noticed, is easier than its score says.
- **Old links changed.** `/hard/42` still works and opens a hard board for seed 42, but not the board the pre-platform generator produced.
