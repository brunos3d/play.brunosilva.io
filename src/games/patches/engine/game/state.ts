import { cellKey, rectCells, unionRect } from "../board/geometry";
import { buildRegion, regionIdForClue, regionRect } from "../regions/region";
import type { CellCoordinate, PuzzleShape, Rect, Region } from "../types";
import { canGrowIntoLegal } from "../validation/extendable";
import { type RegionError, cluesInside, validateRegion } from "../validation/validate-region";
import { validateState } from "../validation/validate-state";

export type GameAction =
  | { type: "place"; region: Region }
  | { type: "remove"; region: Region }
  /** A clue's patch grew by another stroke. `previous` is what it was before. */
  | { type: "replace"; region: Region; previous: Region };

export type GameStatus = "playing" | "solved";

export type GameState = {
  puzzleId: string;
  regions: readonly Region[];
  /** Append-only log. Undo pops the last entry and applies its inverse. */
  history: readonly GameAction[];
  status: GameStatus;
  /** Patches placed, including ones later removed. */
  moves: number;
  /** Patches taken off the board by a tap or by Undo. Growing a patch with another stroke is not a redraw. */
  redraws: number;
  hintsUsed: number;
  /**
   * The player asked for the solution. From the first reveal step on, the
   * board accepts no input, and the finished board earns no streak or best time.
   */
  revealed: boolean;
};

/**
 * How a rectangle stands against the rules.
 * - valid: a legal patch.
 * - pending: not legal yet, but it can still grow into a legal patch, so the
 *   player may leave it on the board and come back to it.
 * - invalid: it can never become legal: it holds another clue, overlaps another
 *   patch, exceeds the clue's number, or contradicts the clue's shape for good.
 */
export type RectStatus = "valid" | "pending" | "invalid";

export type PlaceResult =
  | { ok: true; state: GameState; region: Region; solved: boolean; pending: boolean; replaced: Region | null }
  | { ok: false; state: GameState; errors: RegionError[] };

export function createGame(puzzleId: string): GameState {
  return { puzzleId, regions: [], history: [], status: "playing", moves: 0, redraws: 0, hintsUsed: 0, revealed: false };
}

/** Builds the region a rectangle would become, linked to the clue it contains, if any. */
export function regionForRect(puzzle: PuzzleShape, rect: Rect): Region {
  const cells = rectCells(rect);
  const inside = cluesInside(puzzle, cells);
  const clueId = inside.length === 1 ? inside[0].id : "";
  return buildRegion(clueId ? regionIdForClue(clueId) : "region-preview", clueId, cells);
}

/**
 * A drag adds to the patch its clue already has: the result is the smallest
 * rectangle around both. That is what lets a patch be drawn in several strokes.
 * To make a patch smaller, the player taps it off and draws again.
 */
export function mergeWithOwnPatch(puzzle: PuzzleShape, state: Pick<GameState, "regions">, rect: Rect): Rect {
  const cells = rectCells(rect);
  const inside = cluesInside(puzzle, cells);
  if (inside.length > 1) return rect;
  // With a clue inside, the stroke belongs to that clue. Without one, it belongs to the patch it starts on,
  // which is how a second stroke from the far end of an unfinished patch still counts.
  const keys = new Set(cells.map(cellKey));
  const touched = state.regions.filter((region) => region.cells.some((cell) => keys.has(cellKey(cell))));
  const own = inside.length === 1 ? state.regions.find((region) => region.clueId === inside[0].id) : touched.length === 1 ? touched[0] : undefined;
  return own ? unionRect(regionRect(own), rect) : rect;
}

function classify(puzzle: PuzzleShape, state: GameState, rect: Rect): { status: RectStatus; region: Region; errors: RegionError[] } {
  const region = regionForRect(puzzle, mergeWithOwnPatch(puzzle, state, rect));
  // validateRegion skips the region with the same id, so a clue's own patch never blocks its growth.
  const result = validateRegion(puzzle, state.regions, region);
  if (result.ok) return { status: "valid", region, errors: [] };
  const onlyUnfinished = result.clue !== null && result.errors.every((error) => error.code === "wrong-area" || error.code === "wrong-shape");
  const others = state.regions.filter((other) => other.id !== region.id);
  const pending = onlyUnfinished && canGrowIntoLegal(puzzle, others, result.clue!, regionRect(region));
  return { status: pending ? "pending" : "invalid", region, errors: result.errors };
}

/** Live feedback for a drag. */
export function previewRect(puzzle: PuzzleShape, state: GameState, rect: Rect): { status: RectStatus; errors: RegionError[] } {
  const { status, errors } = classify(puzzle, state, rect);
  return { status, errors };
}

/** Patches on the board that are not legal yet. The board cannot be complete while there is one. */
export function pendingRegionIds(puzzle: PuzzleShape, state: Pick<GameState, "regions">): Set<string> {
  return new Set(state.regions.filter((region) => !validateRegion(puzzle, state.regions, region).ok).map((region) => region.id));
}

/**
 * Puts a rectangle on the board if it is legal, or if it can still become
 * legal. Only a rectangle that can never be right is refused, and then the
 * state is untouched and the reason comes back. A legal patch stays even when
 * it is not the one from the solution: the player finds that out by deduction
 * or by a hint. Completion is decided by the full validator, never by counting
 * covered cells, so a pending patch can never finish a board.
 */
export function placeRegion(puzzle: PuzzleShape, state: GameState, rect: Rect): PlaceResult {
  if (isLocked(state)) return { ok: false, state, errors: [] };
  const { status, region, errors } = classify(puzzle, state, rect);
  if (status === "invalid") return { ok: false, state, errors };

  const previous = state.regions.find((other) => other.id === region.id) ?? null;
  if (previous && previous.cells.length === region.cells.length && previous.cells.every((cell, index) => cellKey(cell) === cellKey(region.cells[index]))) {
    return { ok: false, state, errors: [] };
  }

  const regions = [...state.regions.filter((other) => other.id !== region.id), region];
  const solved = validateState(puzzle, regions).complete;
  return {
    ok: true,
    region,
    solved,
    pending: status === "pending",
    replaced: previous,
    state: {
      ...state,
      regions,
      history: [...state.history, previous ? { type: "replace", region, previous } : { type: "place", region }],
      moves: state.moves + 1,
      status: solved ? "solved" : "playing",
    },
  };
}

export function regionAt(state: GameState, cell: CellCoordinate): Region | null {
  const key = cellKey(cell);
  return state.regions.find((region) => region.cells.some((other) => cellKey(other) === key)) ?? null;
}

/** Tap-to-remove. Returns the same state when the cell is empty or the puzzle is solved. */
export function removeRegionAt(state: GameState, cell: CellCoordinate): GameState {
  if (isLocked(state)) return state;
  const region = regionAt(state, cell);
  if (!region) return state;
  return {
    ...state,
    regions: state.regions.filter((other) => other.id !== region.id),
    history: [...state.history, { type: "remove", region }],
    redraws: state.redraws + 1,
  };
}

/** No more input: the puzzle is solved, or its solution is being revealed. */
export function isLocked(state: GameState): boolean {
  return state.status === "solved" || state.revealed;
}

export function canUndo(state: GameState): boolean {
  return !isLocked(state) && state.history.length > 0;
}

/** Reverts the last action. Undoing a placement or a replacement counts as a redraw, undoing a removal does not. */
export function undo(state: GameState): GameState {
  if (!canUndo(state)) return state;
  const last = state.history[state.history.length - 1];
  const history = state.history.slice(0, -1);
  if (last.type === "place") {
    return {
      ...state,
      history,
      regions: state.regions.filter((region) => region.id !== last.region.id),
      redraws: state.redraws + 1,
    };
  }
  if (last.type === "replace") {
    return {
      ...state,
      history,
      regions: [...state.regions.filter((region) => region.id !== last.region.id), last.previous],
      redraws: state.redraws + 1,
    };
  }
  return { ...state, history, regions: [...state.regions, last.region] };
}

/**
 * Clears the board and the undo log. Puzzle identity, hint count, redraw count
 * and move count survive, so a reset cannot polish a daily result.
 */
export function resetGame(state: GameState): GameState {
  if (isLocked(state)) return state;
  return { ...state, regions: [], history: [] };
}

export function recordHint(state: GameState): GameState {
  return isLocked(state) ? state : { ...state, hintsUsed: state.hintsUsed + 1 };
}

const sameCells = (a: Region, b: Region): boolean => a.cells.length === b.cells.length && a.cells.every((cell, index) => cellKey(cell) === cellKey(b.cells[index]));

export type RevealStep = { state: GameState; change: { type: "remove" | "place"; region: Region } | null };

/**
 * One step of revealing the solution. Patches that are not part of it come off
 * first, one per step, then the missing ones go on in reading order. The UI
 * calls this on a timer, which gives the reveal its piece-by-piece rhythm, and
 * a reload in the middle simply carries on from the saved board.
 */
export function revealStep(solution: readonly Region[], state: GameState): RevealStep {
  if (state.status === "solved") return { state, change: null };
  const locked: GameState = state.revealed ? state : { ...state, revealed: true, history: [] };

  const wrong = locked.regions.find((region) => !solution.some((target) => target.id === region.id && sameCells(target, region)));
  if (wrong) {
    return { state: { ...locked, regions: locked.regions.filter((region) => region !== wrong) }, change: { type: "remove", region: wrong } };
  }

  const missing = solution.find((target) => !locked.regions.some((region) => region.id === target.id));
  if (!missing) return { state: { ...locked, status: "solved" }, change: null };
  const regions = [...locked.regions, missing];
  return { state: { ...locked, regions, status: regions.length === solution.length ? "solved" : "playing" }, change: { type: "place", region: missing } };
}
