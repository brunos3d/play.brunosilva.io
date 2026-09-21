# Difficulty

`evaluateDifficulty(puzzle)` returns a score from 0 to about 100, a tier, a breakdown per term and the quality metrics. It solves the puzzle the way a person would and measures what that took. Board size is one input among seven, so a small board full of numberless clues can outrank a large, fully labelled one.

## Score

Each term is normalized to 0..1 and multiplied by its weight.

| Term | Weight | Measures |
|---|---|---|
| `size` | 12 | cells, from 25 (5x5) to 100 (10x10) |
| `ambiguity` | 22 | log2 of the average candidate rectangles per clue, capped at 5 bits |
| `unknowns` | 14 | share of clues without a number |
| `technique` | 22 | average cost per patch: clue-single 1, cell-single 2, +3 when lookahead was needed |
| `opening` | 14 | 1 minus the share of patches forced on the empty board |
| `depth` | 16 | rounds of deduction, 1 to 8 |
| `guessing` | 25 | patches logic could not reach. Generated puzzles always score 0 here |

The `guessing` term only matters for hand-made boards passed to the evaluator. Because generated puzzles never use it, their practical ceiling is about 75.

## Tiers

| Tier | Band | Generator target | Daily sizes | Mean patch area | Max share forced on empty board |
|---|---|---|---|---|---|
| easy | 0 to 28 | 10 to 25 | 5x5, 6x6 | 5.0 | 0.85 |
| medium | 28 to 45 | 31 to 42 | 6x6, 7x7 | 4.8 | 0.60 |
| hard | 45 to 60 | 48 to 57 | 7x7, 8x8 | 4.4 | 0.45 |
| expert | 60 and up | 63 to 72 | 7x7, 8x8 | 4.0 | 0.35 |

Harder tiers use smaller patches. That follows the original: its Sunday 7x7 had 14 patches while its Friday 7x7 had 8. Practice mode can force any size from 5x5 to 10x10 on any tier, and the size term moves the score with it.

The bands were calibrated with the benchmark. The first draft put expert at 70 to 100, and only 2 of 25 puzzles reached it after 16 attempts each, because the guessing weight is unreachable for fair puzzles. With the bands above, 99.9% to 100% of 1000 puzzles per tier land in band.

Measured means over 1000 puzzles: easy 18.9, medium 36.5, hard 51.5, expert 62.2. A test checks that the tier means are strictly increasing.

## Metrics

`QualityMetrics` is stored in `puzzle.metadata.metrics`:

| Metric | Meaning |
|---|---|
| `solutionCount` | from the search, capped at 2 |
| `candidateCount`, `averageCandidateCount` | rectangles per clue before any deduction |
| `forcedMoveCount` | patches forced on the empty board |
| `maximumBranchingFactor` | most options at the most constrained cell during search |
| `deductionDepth` | rounds of deduction when every forced patch is placed at once |
| `advancedStepCount` | patches that needed lookahead first |
| `guessCount` | patches logic could not reach |
| `clueDensity` | clues per cell |
| `unknownClueRatio` | share of clues without a number |
| `solverNodes` | search nodes visited |

## Order independence

The score is a property of the puzzle, not of how its clues are listed. `tests/patches/invariance.test.ts` shuffles the clue order of 45 generated puzzles three times each and requires the same score and depth. This test exists because an earlier elimination pass broke the property (see `SOLVER.md`).

## Weekly schedule

| Day | Tier |
|---|---|
| Monday | easy |
| Tuesday | easy or medium |
| Wednesday | medium |
| Thursday | medium or hard |
| Friday | hard |
| Saturday | hard |
| Sunday | expert |

On mixed days the date picks the tier through the seeded PRNG, so every player gets the same one. The table is `DEFAULT_WEEKLY_SCHEDULE` in `src/shared/engine/daily.ts`, shared with Zip, and `getDailyPuzzle` accepts a custom config.
