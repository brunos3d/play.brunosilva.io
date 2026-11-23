import { WEND_MAX_WORD } from "../config";
import { areNeighbours, cellSetKey, isPath } from "../grid";
import type { WendShape } from "../types";

/**
 * A line the player has drawn through letters. It stays on the board whether it
 * spells anything or not. Once it covers a hidden word, letter for letter, it
 * is found: `word` then holds that word's index and the trail can no longer be
 * changed.
 */
export type Trail = {
  id: number;
  cells: readonly number[];
  word: number | null;
  /** How many of its first letters hints revealed. The word list shows those, and only those. */
  hinted: number;
};

export type WendState = {
  puzzleId: string;
  trails: readonly Trail[];
  nextId: number;
  /** The trail a tap extends: the last one touched that is still open. */
  active: number | null;
  /** Earlier boards, for undo. Each entry is the open trails before one gesture. Found words are never undone. */
  history: readonly (readonly Trail[])[];
  status: "playing" | "solved";
  /** Gestures that changed the board. */
  moves: number;
  /** Trails of two letters or more that were thrown away: erased by the player, by a reset or by a hint. */
  mistakes: number;
  hintsUsed: number;
  revealed: boolean;
};

/** One press-drag-release, from the moment the finger goes down. */
export type Stroke = {
  /** The state to return to if the gesture ends up changing nothing, and the one undo goes back to. */
  before: WendState;
  /** The trail this gesture edits. */
  trail: number;
  /** Where on an existing trail the press landed. Null when the press started a new trail. */
  pressedAt: number | null;
  /** The pointer has entered another cell since the press. A gesture that never does is a tap. */
  moved: boolean;
};

export function createWendGame(puzzleId: string): WendState {
  return { puzzleId, trails: [], nextId: 1, active: null, history: [], status: "playing", moves: 0, mistakes: 0, hintsUsed: 0, revealed: false };
}

export const isWendLocked = (state: WendState): boolean => state.status === "solved" || state.revealed;
export const openTrails = (state: WendState): Trail[] => state.trails.filter((trail) => trail.word === null);
export const foundWords = (state: WendState): number[] => state.trails.flatMap((trail) => (trail.word === null ? [] : [trail.word]));
export const canUndoWend = (state: WendState): boolean => !isWendLocked(state) && state.history.length > 0;
export const canResetWend = (state: WendState): boolean => !isWendLocked(state) && openTrails(state).length > 0;
export const trailAt = (state: WendState, cell: number): Trail | undefined => state.trails.find((trail) => trail.cells.includes(cell));
export const trailLetters = (shape: WendShape, cells: readonly number[]): string => cells.map((cell) => shape.letters[cell]).join("");

/** No trail may grow past the longest word that is still hidden. */
export function longestOpenWord(shape: WendShape, state: WendState): number {
  const found = new Set(foundWords(state));
  let longest = 0;
  shape.words.forEach((word, index) => {
    if (!found.has(index)) longest = Math.max(longest, word.text.length);
  });
  return Math.min(longest, WEND_MAX_WORD);
}

/**
 * The hidden word a trail has found, or null. A word is found when the trail
 * spells it over the very cells the word occupies. The board has one solution,
 * so the same word traced through other cells is a dead end and stays open.
 */
export function wordFoundBy(shape: WendShape, state: WendState, cells: readonly number[]): number | null {
  const found = new Set(foundWords(state));
  const letters = trailLetters(shape, cells);
  const key = cellSetKey(cells);
  const index = shape.words.findIndex((word, at) => !found.has(at) && word.text === letters && cellSetKey(word.path) === key);
  return index === -1 ? null : index;
}

/** True when the trail spells a hidden word that lies somewhere else on the board. */
export function spellsWordElsewhere(shape: WendShape, state: WendState, cells: readonly number[]): boolean {
  const found = new Set(foundWords(state));
  const letters = trailLetters(shape, cells);
  return shape.words.some((word, at) => !found.has(at) && word.text === letters) && wordFoundBy(shape, state, cells) === null;
}

/**
 * The hidden word an open trail is on its way to: the trail matches the start
 * of that word's path, cell for cell. Null for a trail that leads nowhere.
 */
export function wordStartedBy(shape: WendShape, state: WendState, cells: readonly number[]): number | null {
  const found = new Set(foundWords(state));
  const index = shape.words.findIndex((word, at) => !found.has(at) && cells.length <= word.path.length && cells.every((cell, step) => word.path[step] === cell));
  return index === -1 ? null : index;
}

const withTrail = (state: WendState, id: number, change: (trail: Trail) => Trail | null): WendState => ({
  ...state,
  trails: state.trails.flatMap((trail) => {
    if (trail.id !== id) return [trail];
    const next = change(trail);
    return next ? [next] : [];
  }),
});

/**
 * A press on the board. Returns null when the press does nothing: a wall, or a
 * letter of a word that is already found. A press on a free letter starts a
 * one-letter trail. A press on an open trail picks that trail up, and what
 * happens next depends on whether the gesture turns into a drag or stays a tap.
 */
export function startStroke(shape: WendShape, state: WendState, cell: number): { state: WendState; stroke: Stroke } | null {
  if (isWendLocked(state) || shape.letters[cell] === "" || shape.letters[cell] === undefined) return null;
  const existing = trailAt(state, cell);
  if (existing) {
    if (existing.word !== null) return null;
    return { state: { ...state, active: existing.id }, stroke: { before: state, trail: existing.id, pressedAt: existing.cells.indexOf(cell), moved: false } };
  }
  const trail: Trail = { id: state.nextId, cells: [cell], word: null, hinted: 0 };
  return {
    state: { ...state, trails: [...state.trails, trail], nextId: state.nextId + 1, active: trail.id },
    stroke: { before: state, trail: trail.id, pressedAt: null, moved: false },
  };
}

/**
 * The pointer entered a cell during a drag. The trail follows it: onto a free
 * neighbour of its end it grows, onto one of its own cells it shrinks back to
 * that cell, and along a clear straight line it fills the cells in between, so
 * a fast swipe does not leave gaps. Anything else is ignored.
 */
export function moveStroke(shape: WendShape, state: WendState, stroke: Stroke, cell: number): { state: WendState; stroke: Stroke } {
  let current = state;
  let trail = current.trails.find((entry) => entry.id === stroke.trail);
  if (!trail) return { state, stroke };

  // A drag that starts in the middle of a trail first cuts it there.
  if (!stroke.moved && stroke.pressedAt !== null && stroke.pressedAt < trail.cells.length - 1) {
    const cut = stroke.pressedAt + 1;
    current = withTrail(current, trail.id, (entry) => ({ ...entry, cells: entry.cells.slice(0, cut), hinted: Math.min(entry.hinted, cut) }));
    trail = current.trails.find((entry) => entry.id === stroke.trail) as Trail;
  }
  const moved = { ...stroke, moved: true };

  const own = trail.cells.indexOf(cell);
  if (own !== -1) {
    if (own === trail.cells.length - 1) return { state: current, stroke: moved };
    return { state: withTrail(current, trail.id, (entry) => ({ ...entry, cells: entry.cells.slice(0, own + 1), hinted: Math.min(entry.hinted, own + 1) })), stroke: moved };
  }

  const limit = longestOpenWord(shape, current);
  const head = trail.cells[trail.cells.length - 1];
  const steps = stepsBetween(shape.size, head, cell);
  if (!steps) return { state: current, stroke: moved };
  const added: number[] = [];
  for (const step of steps) {
    if (shape.letters[step] === "" || trailAt(current, step) || trail.cells.length + added.length >= limit) break;
    added.push(step);
  }
  if (added.length === 0) return { state: current, stroke: moved };
  return { state: withTrail(current, trail.id, (entry) => ({ ...entry, cells: [...entry.cells, ...added] })), stroke: moved };
}

/** The cells from `from` (not included) to `to` (included) along a row or a column. Null when they share neither. */
function stepsBetween(size: number, from: number, to: number): number[] | null {
  const [fromRow, fromColumn, toRow, toColumn] = [Math.floor(from / size), from % size, Math.floor(to / size), to % size];
  if (fromRow !== toRow && fromColumn !== toColumn) return null;
  const step = fromRow === toRow ? Math.sign(toColumn - fromColumn) : Math.sign(toRow - fromRow) * size;
  const steps: number[] = [];
  for (let cell = from + step; cell !== to + step; cell += step) steps.push(cell);
  return steps;
}

export type StrokeResult = {
  state: WendState;
  /** The gesture changed the board. */
  changed: boolean;
  /** Index of the word this gesture found. */
  found: number | null;
  solved: boolean;
  /** A trail was erased whole. */
  erased: boolean;
  /** The trail spells a hidden word, but over the wrong cells. */
  elsewhere: boolean;
};

/**
 * The finger lifts. A tap is resolved here: on the first letter of a trail it
 * erases the trail, in the middle it cuts the trail there, and on a free letter
 * next to the end of the trail touched last it adds that letter to it, so words
 * can be entered one tap at a time. Then the trail is checked against the
 * hidden words.
 */
export function endStroke(shape: WendShape, state: WendState, stroke: Stroke): StrokeResult {
  let current = state;
  let erased = false;
  const before = stroke.before;

  if (!stroke.moved) {
    const trail = current.trails.find((entry) => entry.id === stroke.trail);
    if (trail && stroke.pressedAt === null) {
      // A tap on a free letter. It joins the previous trail when it sits right after its end.
      const previous = before.trails.find((entry) => entry.id === before.active && entry.word === null);
      const cell = trail.cells[0];
      if (previous && areNeighbours(shape.size, previous.cells[previous.cells.length - 1], cell) && previous.cells.length < longestOpenWord(shape, before)) {
        current = { ...before, trails: before.trails.map((entry) => (entry.id === previous.id ? { ...entry, cells: [...entry.cells, cell] } : entry)), active: previous.id };
      }
    } else if (trail && stroke.pressedAt === 0) {
      current = { ...withTrail(current, trail.id, () => null), active: null };
      erased = true;
    } else if (trail && stroke.pressedAt !== null && stroke.pressedAt < trail.cells.length - 1) {
      const cut = stroke.pressedAt + 1;
      current = withTrail(current, trail.id, (entry) => ({ ...entry, cells: entry.cells.slice(0, cut), hinted: Math.min(entry.hinted, cut) }));
    }
  }

  const changed = !sameTrails(before.trails, current.trails);
  if (!changed) return { state: { ...before, active: current.active }, changed: false, found: null, solved: false, erased: false, elsewhere: false };

  const edited = current.trails.find((entry) => entry.id === current.active);
  const found = edited ? wordFoundBy(shape, current, edited.cells) : null;
  const elsewhere = edited !== undefined && found === null && spellsWordElsewhere(shape, current, edited.cells);
  current = { ...current, moves: before.moves + 1, mistakes: before.mistakes + (erased && lostTrail(before, current) ? 1 : 0), history: [...before.history, openTrails(before)] };
  if (found !== null && edited) current = lockTrail(shape, current, edited.id, found);
  return { state: current, changed: true, found, solved: current.status === "solved", erased, elsewhere };
}

const sameTrails = (a: readonly Trail[], b: readonly Trail[]): boolean => a.length === b.length && a.every((trail, index) => trail.id === b[index].id && trail.cells.length === b[index].cells.length && trail.cells.every((cell, at) => cell === b[index].cells[at]));

/** True when a trail of two letters or more is gone from one state to the next. */
const lostTrail = (before: WendState, after: WendState): boolean => before.trails.some((trail) => trail.cells.length >= 2 && !after.trails.some((entry) => entry.id === trail.id));

/** Marks a trail as a found word. History goes with it: a found word is not undone, and older boards may overlap it. */
function lockTrail(shape: WendShape, state: WendState, id: number, word: number): WendState {
  const trails = state.trails.map((trail) => (trail.id === id ? { ...trail, word } : trail));
  const solved = trails.filter((trail) => trail.word !== null).length === shape.words.length;
  return { ...state, trails, history: [], active: null, status: solved ? "solved" : "playing" };
}

/**
 * Keyboard: takes the last letter off the trail touched last. A one-letter
 * trail goes away whole. It is one gesture, so undo brings the letter back.
 */
export function shortenActiveTrail(state: WendState): WendState {
  const trail = state.trails.find((entry) => entry.id === state.active && entry.word === null);
  if (isWendLocked(state) || !trail) return state;
  const length = trail.cells.length - 1;
  const trails = length === 0 ? state.trails.filter((entry) => entry !== trail) : state.trails.map((entry) => (entry === trail ? { ...entry, cells: entry.cells.slice(0, length), hinted: Math.min(entry.hinted, length) } : entry));
  return { ...state, trails, active: length === 0 ? null : trail.id, history: [...state.history, openTrails(state)], moves: state.moves + 1 };
}

/** Goes back one gesture. Found words stay. */
export function undoWend(state: WendState): WendState {
  if (!canUndoWend(state)) return state;
  const previous = state.history[state.history.length - 1];
  return { ...state, trails: [...state.trails.filter((trail) => trail.word !== null), ...previous], history: state.history.slice(0, -1), active: null, moves: state.moves + 1 };
}

/** Erases every open trail. Found words stay, and the clock keeps running. */
export function resetWend(state: WendState): WendState {
  if (!canResetWend(state)) return state;
  const open = openTrails(state);
  return {
    ...state,
    trails: state.trails.filter((trail) => trail.word !== null),
    history: [...state.history, open],
    active: null,
    moves: state.moves + 1,
    mistakes: state.mistakes + open.filter((trail) => trail.cells.length >= 2).length,
  };
}

export type HintStep = {
  state: WendState;
  /** Open trails that led nowhere and were erased first. */
  cleared: number;
  /** The word the hint works on, and the cell it has just revealed. */
  word: number;
  cell: number;
  /** True when the revealed letter starts a word. False when it continues one. */
  first: boolean;
  /** The revealed letter completed the word. */
  found: boolean;
  solved: boolean;
};

/**
 * A hint acts, as in the original game. It first erases every open trail that
 * is not the start of a hidden word. Then it reveals one letter: the next
 * letter of a word the board already has the start of, or else the first letter
 * of the shortest word still hidden.
 */
export function applyWendHint(shape: WendShape, state: WendState): HintStep | null {
  if (isWendLocked(state)) return null;
  const found = new Set(foundWords(state));
  const wrong = openTrails(state).filter((trail) => wordStartedBy(shape, state, trail.cells) === null);
  let current: WendState = {
    ...state,
    trails: state.trails.filter((trail) => !wrong.includes(trail)),
    mistakes: state.mistakes + wrong.filter((trail) => trail.cells.length >= 2).length,
    hintsUsed: state.hintsUsed + 1,
    history: [],
    active: null,
  };

  const started = openTrails(current)
    .map((trail) => ({ trail, word: wordStartedBy(shape, current, trail.cells) as number }))
    .sort((a, b) => a.word - b.word)[0];
  const word = started ? started.word : shape.words.findIndex((_, index) => !found.has(index));
  if (word === -1) return null;
  const path = shape.words[word].path;

  let trail: Trail;
  if (started) {
    trail = { ...started.trail, cells: path.slice(0, started.trail.cells.length + 1), hinted: started.trail.cells.length + 1 };
    current = { ...current, trails: current.trails.map((entry) => (entry.id === trail.id ? trail : entry)) };
  } else {
    trail = { id: current.nextId, cells: [path[0]], word: null, hinted: 1 };
    current = { ...current, trails: [...current.trails, trail], nextId: current.nextId + 1 };
  }
  const complete = trail.cells.length === path.length;
  if (complete) current = lockTrail(shape, current, trail.id, word);
  else current = { ...current, active: trail.id };
  return { state: current, cleared: wrong.length, word, cell: trail.cells[trail.cells.length - 1], first: !started, found: complete, solved: current.status === "solved" };
}

/** Marks the game as given up. The reveal then lays the words down one at a time with `revealWord`. */
export function beginWendReveal(state: WendState): WendState {
  if (isWendLocked(state)) return state;
  return { ...state, trails: state.trails.filter((trail) => trail.word !== null), history: [], active: null, revealed: true };
}

/** Lays down the next hidden word of a revealed game. Returns the same state when none is left. */
export function revealWord(shape: WendShape, state: WendState): WendState {
  const found = new Set(foundWords(state));
  const word = shape.words.findIndex((_, index) => !found.has(index));
  if (word === -1) return state;
  const trail: Trail = { id: state.nextId, cells: shape.words[word].path, word, hinted: 0 };
  const trails = [...state.trails, trail];
  return { ...state, trails, nextId: state.nextId + 1, status: trails.length === shape.words.length ? "solved" : "playing" };
}

/**
 * Rebuilds a state from stored trails. Stored data is untrusted: each trail must
 * be a real path over letters, no two may share a cell, and whether a trail is
 * a found word is worked out again from the puzzle. Returns null on anything off.
 */
export function restoreTrails(shape: WendShape, puzzleId: string, stored: readonly { cells: readonly number[]; hinted: number }[]): WendState | null {
  const used = new Set<number>();
  let state = createWendGame(puzzleId);
  for (const entry of stored) {
    if (entry.cells.length === 0 || entry.cells.length > WEND_MAX_WORD || !isPath(shape.size, entry.cells)) return null;
    for (const cell of entry.cells) {
      if (shape.letters[cell] === "" || used.has(cell)) return null;
      used.add(cell);
    }
    const word = wordFoundBy(shape, state, entry.cells);
    const hinted = Number.isInteger(entry.hinted) && entry.hinted > 0 && entry.hinted <= entry.cells.length && wordStartedBy(shape, state, entry.cells.slice(0, entry.hinted)) !== null ? entry.hinted : 0;
    const trail: Trail = { id: state.nextId, cells: [...entry.cells], word, hinted };
    state = { ...state, trails: [...state.trails, trail], nextId: state.nextId + 1 };
  }
  const solved = state.trails.filter((trail) => trail.word !== null).length === shape.words.length;
  return { ...state, status: solved ? "solved" : "playing" };
}

/**
 * What the word list shows for each hidden word: the whole word once found, the
 * letters hints have revealed while it is open, and nothing otherwise. Letters
 * the player traced are never shown here, or the list would say whether a guess
 * is on the right track.
 */
export function wordListRows(shape: WendShape, state: WendState): { found: boolean; shown: number; trail: number | null }[] {
  return shape.words.map((word, index) => {
    const locked = state.trails.find((trail) => trail.word === index);
    if (locked) return { found: true, shown: word.text.length, trail: locked.id };
    const hinted = state.trails.find((trail) => trail.word === null && trail.hinted > 0 && trail.cells.slice(0, trail.hinted).every((cell, step) => word.path[step] === cell));
    return { found: false, shown: hinted ? hinted.hinted : 0, trail: hinted ? hinted.id : null };
  });
}
