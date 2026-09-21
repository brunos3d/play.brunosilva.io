# Solver

Two solvers share one candidate model. The search answers "how many solutions". The logic solver answers "how would a person get there", which drives hints and difficulty.

## Candidates

`buildCandidates(puzzle)` lists, for every clue, each rectangle that contains the clue cell, stays on the board, satisfies the clue's number and shape, and contains no other clue. A 2D prefix sum over clue cells makes the "exactly one clue" test constant time.

Each candidate stores its cell indices and a bitmask (`Int32Array`, 32 cells per word, 4 words for 10x10). Overlap between two candidates is a few ANDs. Candidates are indexed by clue and by covered cell.

Real puzzle #188 (6x6, six clues, three of them numberless) has 50 candidates: 1, 20, 1, 14, 2 and 12 per clue.

## Search

`solve()` is an exact-cover search by backtracking: every cell must be covered once and every clue owns one rectangle.

1. If every cell is covered, record a solution. All clues are placed at that point, because a clue cell can only be covered by its own clue's candidates.
2. Find the uncovered cell with the fewest live candidates (minimum remaining values). A candidate is live if its clue is unplaced and its mask misses the occupied mask. Counting stops early once a cell cannot beat the current best.
3. Zero live candidates: dead end. The same test catches a clue that ran out of options.
4. Otherwise branch on that cell's candidates.

Options: `maxSolutions` (default 2, enough to decide uniqueness), `fixed` placements (the player's board, for hints), a shared `candidates` set, and `maxNodes` as a safety valve. `unique` is true only with exactly one solution and no abort.

Dancing Links was considered and not used. With at most 100 cells and a few hundred candidates, bitmask backtracking with MRV solves generated puzzles in 0.02 to 0.13 ms on average (worst case 1.5 ms over 4000 puzzles), and the code stays short.

Verified against real data: the search finds exactly one solution for LinkedIn puzzle #188, and it matches the published answer.

## Logic solver

`solveWithLogic()` places patches only when they are forced, and records why.

| Technique | Meaning | Guide strategy it models |
|---|---|---|
| `clue-single` | the clue has one live rectangle | primes are strips, number plus icon fixes the size, edges limit growth |
| `cell-single` | an uncovered cell is reachable by one live rectangle | "if only one patch can reach a cell, it is forced" |
| lookahead elimination | a rectangle is dead if placing it would leave a cell or a clue with no rectangle | "do not strand a cell" |
| `search` | logic made no progress, the search supplies a patch | guessing |

Each round places every forced patch at once (one "wave"). When nothing is forced, one elimination pass runs, and later steps are flagged `neededElimination`. The "cells common to all options of a clue" argument is covered by elimination: a rival rectangle on such a cell leaves that clue with nothing.

Elimination collects its verdicts against a frozen board and applies them afterwards. An earlier version removed rectangles while iterating, which made wave counts depend on clue order, so the same puzzle scored 64.0 or 64.4 depending on how its clues were listed. A test now shuffles clue order and requires identical scores.

Generated puzzles must solve with zero `search` steps. That is the fairness guarantee: every daily and practice puzzle can be finished by deduction alone.

## Trace example

`npm run patches:solve -- --seed 12345 --difficulty hard --steps` prints the logic path, one line per patch: the round, the technique, whether lookahead was needed, the clue and the rectangle.
