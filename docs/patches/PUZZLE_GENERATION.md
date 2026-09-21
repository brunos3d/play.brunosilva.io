# Puzzle generation

`generateFromSpec(spec)` in `engine/generator/generate.ts` builds a puzzle from a seed spec. It has no access to the clock, `Math.random` or the DOM. `generatePuzzle(seed, difficulty, options)` is a thin wrapper.

## Pipeline

1. **Size.** Taken from the spec, or drawn from the tier's sizes using a PRNG stream keyed `<key>|size`.
2. **Partition.** `randomPartition` tiles the board with rectangles.
3. **Clue cells.** One random cell per rectangle.
4. **Initial information.** Each clue gets number and shape, number only, shape only, or neither, drawn from the tier's mix.
5. **Uniqueness repair.** Add information until the solver finds exactly one solution.
6. **Shape floor.** Make sure enough clues carry a real shape icon.
7. **Difficulty tuning.** Hide or reveal one piece of information at a time until the score lands in the puzzle's target window.
8. **Acceptance.** Keep the attempt if it is unique, needs no guessing, is inside the tier band, and does not hand out too many patches on the empty board. Otherwise try the next attempt, up to 40, and keep the best.
9. **Icons.** Clues without a real shape rule get the dashed freeform icon with some probability. This is cosmetic: freeform and no icon accept the same rectangles.

Each attempt has its own PRNG stream (`<key>|attempt|<n>`), and icons have theirs. Attempt 7 is the same puzzle whether or not attempts 1 to 6 were tried, which makes failures reproducible.

## Partition

The board is filled in scan order. The first empty cell becomes the top-left corner of a new rectangle. Everything below that cell is always free (any rectangle reaching a lower row in that column would have started at or above the current row and would cover the current cell), so only the width needs a collision check. A 1x1 always fits, so a fill never fails.

Sizes are drawn from a bell curve around the tier's `meanArea`. 1x1 rectangles get a tiny weight, strips of five or more cells are penalized, and area is capped at a third of the board or 12 cells. A fill is kept when it has no 1x1 and at least three distinct sizes. After 120 tries the fill with the fewest 1x1 patches wins. In practice no generated puzzle contains a 1x1, and a test asserts it over 200 partitions.

Scan-order filling leaves a directional bias, so the result is randomly transposed and mirrored.

## Uniqueness repair

The solver is asked for two solutions. With two, the generator takes the clues whose rectangles differ and strengthens the one that says the least: number first, then shape. If every differing clue already shows both, the clue cell moves to a cell of its true rectangle that the rival rectangle does not cover. A board that is still ambiguous after 40 rounds is discarded.

## Shape floor

Shape icons are what separate this game from plain Shikaku. Tuning tends to strip them, because a shape is often redundant next to a number. Every board therefore keeps a real shape icon on at least 15% of its clues, and never fewer than 2. Before the floor existed, about 1% of boards had no icon at all. Adding information cannot break uniqueness, so the floor is safe to apply after repair.

## Tuning

Each attempt draws a target score inside the tier's `targetRange` and accepts a window of 3 points around it, clipped to the tier band. Without per-puzzle targets, tuning stopped at the first score inside the band and hard puzzles bunched at 50 to 56.

A tuning move flips one flag (`showArea` or `showShape`) on one clue. It is kept only if the puzzle stays unique, still needs zero guesses, and moves closer to the window. Drafts stay sorted by clue cell while they are scored, so the score that was tuned is the score that ships. A test checks that `evaluateDifficulty(puzzle).score` equals the stored `difficultyScore` for every bulk puzzle.

## Quality rules

| Problem | Guard |
|---|---|
| Decorative or unsolvable board | built from a real tiling, so a solution exists by construction, and `validatePuzzle` re-checks it |
| Several solutions | uniqueness repair, then `solutionCount === 1` on every accepted puzzle |
| Impossible deductions | zero `search` steps allowed in the logic trace |
| Obvious first moves everywhere | `maxInitialForcedRatio` per tier: 0.85, 0.6, 0.45, 0.35 |
| Too much or too little information | the tier's clue mix plus the score band |
| Near-identical boards | random tiling with symmetry. Measured duplicate rate below |
| Plain Shikaku boards | shape floor |

## Benchmark

`npm run patches:benchmark` generates 100, 500 and 1000 puzzles per tier. Results from the 1000 series on a desktop machine:

| Tier | Boards | Mean clues | Generation mean / p95 / max (ms) | Solver mean (ms) | In tier | Invalid | Exact duplicates |
|---|---|---|---|---|---|---|---|
| easy | 5x5, 6x6 | 8.0 | 0.21 / 0.59 / 3.9 | 0.02 | 100% | 0 | 0 |
| medium | 6x6, 7x7 | 10.9 | 0.37 / 0.90 / 2.6 | 0.03 | 100% | 0 | 0 |
| hard | 7x7, 8x8 | 15.0 | 1.47 / 3.77 / 27.5 | 0.08 | 100% | 0 | 0 |
| expert | 7x7, 8x8 | 15.0 | 15.6 / 45.3 / 98.7 | 0.11 | 99.9% | 0 | 0 |

Across all three series (6400 puzzles) every puzzle had exactly one solution and none was invalid. One pair of easy puzzles in 1000 shared a tiling with different clues, which is expected on a 5x5 board.

Clue mix in the 1000 series, as number and shape / number only / shape only / neither: easy 52 / 39 / 7 / 2, medium 32 / 42 / 17 / 9, hard 18 / 47 / 19 / 16, expert 9 / 41 / 19 / 30 percent.

Forcing 10x10 (`--size 10`, 40 puzzles per tier) keeps generation under 82 ms for every tier.

## Known weaknesses

- **Expert scores are compressed.** Guessing is never allowed, which caps fair puzzles near 70. Expert results sit between 59 and 70 with a mean of 62, at the low end of the 63 to 72 target range. Expert also needs about 4.7 attempts per puzzle, against roughly 1 for the other tiers.
- **Rare tier misses.** 3 of 1600 expert puzzles scored 59.3 to 59.5, just under the band's floor of 60. The generator returns its best attempt in that case. `metadata.measuredDifficulty` records the tier the score falls in, so the miss is visible.
- **No themes.** The original's puzzles are hand-made around a visual idea and carry titles. These are procedural and have neither.
- **Two techniques plus lookahead.** Difficulty is measured against the logic solver's repertoire. A puzzle that needs a deeper argument than one-step lookahead is rejected, not rated, so the hardest fair puzzles are out of reach.
