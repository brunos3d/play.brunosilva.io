# Patches engine

Rules, data model and public API of `src/games/patches/engine`. The research behind the rules is in `PATCHES_REFERENCE.md`.

## Rules

The board is a grid. The player covers it with rectangles called patches.

1. Every patch is a filled, axis-aligned rectangle.
2. Every patch contains exactly one clue cell.
3. Patches do not overlap.
4. Every cell belongs to a patch.
5. Every patch satisfies its clue.

A clue can carry a number, a shape, both or neither:

| Clue | Accepts |
|---|---|
| `area: n` | rectangles of exactly `n` cells |
| `shape: "square"` | width = height (a 1x1 counts) |
| `shape: "tall"` | height > width |
| `shape: "wide"` | width > height |
| `shape: "freeform"` | any rectangle, drawn with a dashed icon |
| `shape: "unconstrained"` or missing | any rectangle, drawn with no icon |

Tall and wide are strict, so a square satisfies neither. `freeform` never means a polyomino or disconnected cells.

## Data model

```ts
type Clue = { id: string; row: number; column: number; area?: number; shape?: ShapeConstraint };

type Region = {
  id: string; clueId: string; cells: CellCoordinate[];
  area: number; width: number; height: number;
  shape: "square" | "tall" | "wide" | "irregular";
};

type Puzzle = {
  id: string; seed: string; version: number;
  width: number; height: number; difficulty: Difficulty;
  clues: Clue[]; solution: Region[]; metadata: PuzzleMetadata;
};
```

A `Puzzle` is plain JSON. Width and height are separate fields, so non-square boards work even though no mode generates them. Rule functions take `PuzzleShape` (`width`, `height`, `clues`), which lets tests and the tutorial build boards by hand.

`buildRegion(id, clueId, cells)` is the only way to make a region. It computes area, width, height and shape from the cells. `validateRegion` recomputes them again from `region.cells` and ignores the cached fields, so a forged region (`area: 4` on three cells) is rejected. A test covers this.

## Validation

`validateRegion(puzzle, placed, region)` returns `{ ok, errors, clue }` with these codes: `empty`, `out-of-bounds`, `not-rectangle`, `no-clue`, `multiple-clues`, `clue-mismatch`, `wrong-area`, `wrong-shape`, `overlap`. Each error has a sentence the UI shows as is.

`validateState(puzzle, regions)` reports `complete`, `consistent`, `uncoveredCells`, `overlappingCells`, `unusedClueIds`, `duplicatedClueIds` and per-region errors. `complete` requires full coverage, no overlap, every region legal, and every clue used once. It is the only completion check in the project. A test places two 4x2 patches that fill a 4x4 board and confirms the board is not complete.

`validatePuzzle(puzzle)` audits a generated puzzle without trusting the generator: it checks the clues, runs the stored solution through `validateState`, recounts solutions with the solver, and compares the solver's answer with the stored one.

## Game state

```ts
type GameState = {
  puzzleId: string; regions: readonly Region[]; history: readonly GameAction[];
  status: "playing" | "solved"; moves: number; redraws: number; hintsUsed: number;
  revealed: boolean;
};
type GameAction =
  | { type: "place"; region: Region }
  | { type: "remove"; region: Region }
  | { type: "replace"; region: Region; previous: Region };
```

Every function returns a new state and never mutates its input.

| Function | Behaviour |
|---|---|
| `createGame(puzzleId)` | empty board |
| `previewRect(puzzle, state, rect)` | `neutral` (no clue yet), `valid` or `invalid`, with errors |
| `placeRegion(puzzle, state, rect)` | places if legal, otherwise returns the same state plus errors. A legal patch is placed even if it is not the one from the solution. If the clue already has a patch, the new one replaces it as a single `replace` action and counts one redraw. Drawing the identical patch again does nothing. Runs `validateState` to decide `solved` |
| `removeRegionAt(state, cell)` | tap-to-remove. Counts one redraw |
| `undo(state)` | pops the last action and applies its inverse. Undoing a placement or a replacement counts one redraw, undoing a removal does not. One undo reverts a replacement back to the earlier patch |
| `resetGame(state)` | clears patches and history. Keeps puzzle id, moves, redraws and hints |
| `recordHint(state)` | increments `hintsUsed` |
| `revealStep(solution, state)` | one step of revealing the solution: a wrong patch comes off, or the next missing patch goes on. Sets `revealed`, which locks the board from the first step |
| `isLocked(state)` | solved, or being revealed |

A locked board ignores input: place, remove, undo, reset and hint all return the same state.

Reset keeps the counters and leaves the clock running. The original's behaviour here is unknown, and this choice means a reset cannot polish a daily result.

## Drag extent

`engine/board/drag.ts` holds the drawing rule as pure functions, shared by the pointer and the keyboard: `startExtent(clueCell)`, `extendExtent(extent, cell)` and `extentRect(extent)`. The extent is the bounding rectangle of the clue cell and every visited cell. It only grows, so a clue can end up anywhere inside its patch, not just in a corner, and a fast pointer that skips cells gives the same result as a slow one.

## Clock

The clock is shared by every game and lives in `src/shared/engine/clock.ts`. See `docs/ARCHITECTURE.md`.

## Hints

`getHint(puzzle, regions)` returns one of:

The UI acts on a hint: it removes a wrong patch, or places the proven one.

- `wrong-region`: a placed patch that no solution contains. Checked first, because a deduction built on a wrong patch would mislead. Each patch is tested alone against the solver, then the board is rebuilt in play order to find the first patch that makes it unsolvable.
- `place-region`: the next patch the logic solver can prove, with its rectangle, the technique (`clue-single`, `cell-single` or `search`), an optional focus cell and a one-sentence reason.
- `complete`.

Hints never pick at random. A test follows hints alone on 48 generated puzzles across all tiers and checks that each hint matches the unique solution and that the board ends solved.

## Public API

```ts
generatePuzzle(seed, difficulty, { size?, version? }): Puzzle
generateFromSpec(spec): Puzzle
solvePuzzle(puzzle, { maxSolutions?, fixed?, maxNodes? }): SolveResult
solveWithLogic(puzzle, { fixed?, maxSteps?, allowSearch? }): LogicResult
validatePuzzle(puzzle) / validateRegion(puzzle, placed, region) / validateState(puzzle, regions)
getHint(puzzle, regions): Hint
evaluateDifficulty(puzzle): DifficultyReport
getDailyPuzzle(dateOrInstant, config?): { info, puzzle }
```
