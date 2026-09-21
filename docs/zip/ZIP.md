# Zip

Zip is a path puzzle inspired by LinkedIn's Zip. This document covers its rules, engine, generator and interaction. Platform features it shares with Patches (clock, hints, reveal, results, storage, offline) are in `docs/ARCHITECTURE.md`, and seeds and daily puzzles are in `docs/SEEDS.md`.

## Rules

The rewrite kept the rules of the earlier Zip in this repository unchanged. They now live in one file, `engine/rules.ts`.

1. The path starts on 1.
2. Each step goes to a side neighbour. Diagonals do not connect.
3. The path never crosses a wall.
4. The path never visits a cell twice.
5. Numbered cells are passed in order: 1, 2, 3 and so on.
6. The puzzle is solved when the path covers every cell and ends on the last number.

`checkStep(topology, path, cell)` returns null or the rule that refuses the step, with a sentence for the UI: `start-at-one`, `not-adjacent`, `wall`, `revisit`, `wrong-number`, `path-ended`. `validatePath` walks a whole path through `checkStep` again and is the only completion check. `stepTo` calls it when the path reaches full length, so a full board that ends on the wrong cell is not accepted.

Reaching the last number early is allowed, as it was before: the path then cannot grow, the uncovered cells pulse, and the status line says how many are left.

## Data model

```ts
type ZipPuzzle = {
  id: string; seed: string; version: number;
  width: number; height: number; difficulty: Difficulty;
  checkpoints: { number: number; row: number; column: number }[];
  walls: { a: number; b: number }[];   // cell indices, a < b, side neighbours
  solution: number[];                  // row-major cell indices, in path order
  metadata: ZipMetadata;
};
```

`buildTopology(shape)` precomputes what the rules keep asking: passable neighbours per cell with walls already removed, the number on each cell, and the start and end cells.

## Solver

`solveZip(shape, { maxSolutions, maxNodes, prefix })` is a backtracking search for Hamiltonian paths that take the numbers in order and end on the last one. It works on typed arrays and prunes three ways:

- every unvisited cell must still be reachable from the head (one flood fill per node),
- every unvisited cell needs a way in and a way out, and the end cell a way in,
- the last number may only be entered as the final step.

Neighbours are tried fewest-exits-first (Warnsdorff).

The search budget is a node count. The earlier solver used a time limit (`Date.now()`), which expires sooner on a slow phone, so the same seed could end up with different walls on different devices. That is not acceptable for a daily puzzle that must be the same for everyone. `unique` is true only with exactly one solution and a search that ran to the end.

## Generator

`generateZipFromSpec(spec)`, per attempt, each with its own PRNG stream:

1. **Path.** A random Hamiltonian path by backbiting: start from a plain snake, pick an end of the path and a grid neighbour of it that is not its path neighbour, and reverse the stretch between them. The result is again a Hamiltonian path. Forty moves per cell mix it thoroughly. This replaced the earlier Warnsdorff walk, which could fail and needed a snake fallback, and which favoured wall-hugging spirals. Measured: 0.54 turns per cell at every tier.
2. **Numbers.** 1 on the first cell, the last number on the last cell, the rest spread along the path with jitter. The count comes from the tier's density range, with a minimum of 3.
3. **Walls for uniqueness.** The solver is asked for two solutions. If it finds an impostor, one edge that the impostor uses and the real path does not becomes a wall, so every wall removes at least one wrong answer. This repeats until the solution is unique. The earlier generator added random walls until the puzzle happened to become unique.
4. **Pruning.** Each wall is tried without. If the puzzle stays unique, the wall goes.
5. **Acceptance.** If uniqueness cannot be proven within 40,000 nodes, or the board needs more walls than the tier allows, the attempt is dropped and the next one runs, up to 60.

`validateZipPuzzle` audits a finished puzzle independently with a ten times larger budget: numbers are 1..n, the solver finds exactly one solution, and it is the stored one.

## Tiers

| Tier | Sizes | Numbered cells, share of all cells | Max walls, share of all cells |
|---|---|---|---|
| easy | 5x5, 6x6 | 16% to 22% | 30% |
| medium | 6x6, 7x7 | 12% to 16% | 30% |
| hard | 7x7, 8x8 | 9% to 12% | 32% |
| expert | 8x8 | 7% to 9.5% | 34% |

Numbers are what guide the player, so harder tiers get fewer of them on bigger boards. With fewer numbers the generator needs more walls to pin the solution down: 3.7 on average for easy, 12.6 for expert. Practice mode can force any size from 5x5 to 8x8 on any tier.

Zip has no numeric difficulty score like Patches. The tier is defined by its inputs (size and number density), not by a measurement of the result.

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

`getZipHint` compares the path with the unique solution. If the path left it, the hint is `wrong-turn`: the wrong stretch is hatched for a moment and then cut off, with a message such as "The path goes wrong right after 2". Otherwise it is `extend`: the game draws the path to the next number, cell by cell.

## Interaction

- Press 1 and drag. Pressing the head continues from it, and pressing a neighbour of the head extends to it.
- Dragging back onto one of the last three cells rewinds to it. Farther back needs a tap, so a stray touch cannot wipe a long path. A tap anywhere on the path cuts it there, and the same drag can continue from that cell.
- A fast drag that skips cells still works: a target in the same row or column is reached by walking every cell in between, and a diagonal neighbour by trying both corners. Walking stops at the first refused step.
- A refused step shakes the board, hatches the cell, plays a sound and names the rule. A finger resting on a forbidden cell complains once, not on every pointer event.
- A tap on a cell the path cannot reach (not in line with the head, not a diagonal neighbour) is refused the same way. The same cell crossed during a drag stays silent, or a fast diagonal swipe would buzz all the way.
- The next number wears a pulsing ring, and the head of the path has a marker that shows where to press.
- Keyboard: arrows move the head (the first key puts the path on 1), Backspace takes a step back, Z undoes, H asks for a hint.
- Sound: each step plays a short tone whose pitch rises an octave as the path fills the board, numbers chime, stepping back plays a low note, and a refused step buzzes.

The path is drawn in SVG over the tiles. Its colour runs continuously from one fabric colour to another: each segment is a gradient between its two cells' colours, and a disc in the exact vertex colour closes every joint. Flat-coloured segments with round caps left a darker blob wherever two of them overlapped. The line colour is the tile's own hue made darker and more saturated with CSS relative colour syntax, because mixing a pastel with ink gives a muddy brown.

## Benchmark

`npm run zip:benchmark`, 300 boards per tier on a desktop machine:

| Tier | Boards | Generation mean / p95 / max (ms) | Mean attempts | Numbers | Walls | Invalid |
|---|---|---|---|---|---|---|
| easy | 5x5, 6x6 | 1.6 / 3.7 / 19 | 1.00 | 5.8 | 3.7 | 0 |
| medium | 6x6, 7x7 | 10.7 / 43 / 83 | 1.02 | 6.0 | 6.4 | 0 |
| hard | 7x7, 8x8 | 72.7 / 254 / 548 | 1.52 | 5.8 | 10.2 | 0 |
| expert | 8x8 | 125 / 289 / 431 | 2.00 | 5.3 | 12.6 | 0 |

`npm run zip:validate` audits 925 boards, 365 consecutive dailies among them, with 0 problems.

## Known weaknesses

- **Board size stops at 8x8.** Proving uniqueness is exponential. 9x9 took 1 to 5 seconds per board and 10x10 failed a third of the time, so they were left out instead of shipped slow. A Web Worker and a stronger solver would lift this.
- **Generation can take half a second** on a desktop for an 8x8 board, and several times that on a slow phone. It runs behind a loading board.
- **Repeats on 5x5.** 2 of 300 easy boards shared a path with another board. A 5x5 grid has few Hamiltonian paths. Numbers and walls still differ.
- **No difficulty score.** Two boards of one tier can feel different, because nothing measures how hard the result is to solve.
- **Old links changed.** `/hard/42` still works and opens a hard board for seed 42, but not the board the old generator produced.
