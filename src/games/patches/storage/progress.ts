import { type GameAction, type GameState, createGame } from "../engine/game/state";
import { buildRegion } from "../engine/regions/region";
import { type Clock, restoreClock } from "@/shared/engine/clock";
import type { CellCoordinate, PuzzleShape, Region } from "../engine/types";
import { validateRegion } from "../engine/validation/validate-region";
import { validateState } from "../engine/validation/validate-state";

const SNAPSHOT_VERSION = 2;

type StoredRegion = { clueId: string; cells: CellCoordinate[] };
type StoredAction = { type: GameAction["type"]; region: StoredRegion; previous?: StoredRegion };

/** What goes to disk for one board. Derived fields are left out and rebuilt on load. */
export type GameSnapshot = {
  snapshotVersion: number;
  puzzleId: string;
  seed: string;
  regions: StoredRegion[];
  history: StoredAction[];
  status: GameState["status"];
  moves: number;
  redraws: number;
  hintsUsed: number;
  revealed: boolean;
  /** Wall clock: when the board was first seen, and the final time once it ended. */
  startedAt: number | null;
  finishedMs: number | null;
};

const pack = (region: Region): StoredRegion => ({ clueId: region.clueId, cells: region.cells.map((cell) => ({ ...cell })) });
const unpack = (stored: StoredRegion): Region => buildRegion(`region-${stored.clueId}`, stored.clueId, stored.cells);

export function toSnapshot(state: GameState, seed: string, clock: Clock): GameSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    puzzleId: state.puzzleId,
    seed,
    regions: state.regions.map(pack),
    history: state.history.map((action) => ({
      type: action.type,
      region: pack(action.region),
      ...(action.type === "replace" ? { previous: pack(action.previous) } : {}),
    })),
    status: state.status,
    moves: state.moves,
    redraws: state.redraws,
    hintsUsed: state.hintsUsed,
    revealed: state.revealed,
    startedAt: clock.startedAt,
    finishedMs: clock.finishedMs,
  };
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * Rebuilds a game from disk. Stored data is treated as untrusted: every region
 * is rebuilt from its cells and checked against the rules, and a "solved" flag
 * only survives if the validator agrees. Anything off returns null, and the
 * caller starts a fresh board.
 */
export function fromSnapshot(puzzle: PuzzleShape & { id: string }, snapshot: unknown): { state: GameState; clock: Clock } | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const data = snapshot as Partial<GameSnapshot>;
  if (data.snapshotVersion !== SNAPSHOT_VERSION || data.puzzleId !== puzzle.id) return null;
  if (!Array.isArray(data.regions) || !Array.isArray(data.history)) return null;
  if (!isCount(data.moves) || !isCount(data.redraws) || !isCount(data.hintsUsed)) return null;

  try {
    const regions: Region[] = [];
    for (const stored of data.regions) {
      const region = unpack(stored);
      if (!validateRegion(puzzle, regions, region).ok) return null;
      regions.push(region);
    }
    const history: GameAction[] = data.history.map((action) => {
      if (action.type === "replace") {
        if (!action.previous) throw new Error("bad action");
        return { type: "replace", region: unpack(action.region), previous: unpack(action.previous) };
      }
      if (action.type !== "place" && action.type !== "remove") throw new Error("bad action");
      return { type: action.type, region: unpack(action.region) };
    });
    const solved = validateState(puzzle, regions).complete;
    const clock = restoreClock(data.startedAt, data.finishedMs);
    // A finished board must carry a final time, and an unfinished one must not.
    if (solved !== (clock.finishedMs !== null)) return null;
    return {
      clock,
      state: {
        ...createGame(puzzle.id),
        regions,
        history: solved ? [] : history,
        status: solved ? "solved" : "playing",
        moves: data.moves,
        redraws: data.redraws,
        hintsUsed: data.hintsUsed,
        revealed: data.revealed === true,
      },
    };
  } catch {
    return null;
  }
}
