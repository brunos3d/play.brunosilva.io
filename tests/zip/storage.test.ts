import { describe, expect, it } from "vitest";
import { type ZipState, buildTopology, commitGesture, createZipGame, generateZipPuzzle, revealZipStep, stepTo } from "@/games/zip/engine";
import { fromZipSnapshot, toZipSnapshot } from "@/games/zip/storage/progress";

const puzzle = generateZipPuzzle("storage", "medium", { size: 6 });
const topology = buildTopology(puzzle);
const RUNNING = { startedAt: 1_790_000_000_000, finishedMs: null };

function walk(count: number): ZipState {
  let state = createZipGame(puzzle.id);
  for (const cell of puzzle.solution.slice(0, count)) {
    const result = stepTo(topology, state, cell);
    if (!result.ok) throw new Error("fixture");
    state = result.state;
  }
  return commitGesture(state, []);
}

const roundTrip = (snapshot: unknown) => fromZipSnapshot(puzzle.id, topology, JSON.parse(JSON.stringify(snapshot)));

describe("zip snapshot", () => {
  it("round-trips a path, its undo stack and the running clock", () => {
    const state = walk(9);
    const restored = roundTrip(toZipSnapshot(state, puzzle.seed, RUNNING));
    expect(restored?.state).toEqual(state);
    expect(restored?.clock).toEqual(RUNNING);
  });

  it("restores a finished board as solved only when the validator agrees", () => {
    const solved = walk(puzzle.solution.length);
    expect(solved.status).toBe("solved");
    expect(roundTrip(toZipSnapshot(solved, puzzle.seed, { startedAt: 1, finishedMs: 30_000 }))?.state.status).toBe("solved");
    expect(roundTrip(toZipSnapshot(solved, puzzle.seed, RUNNING))).toBeNull();
  });

  it("rejects a tampered path", () => {
    const good = toZipSnapshot(walk(6), puzzle.seed, RUNNING);
    const teleport = [...good.path.slice(0, 5), puzzle.solution.at(-1)!];
    expect(roundTrip({ ...good, path: teleport })).toBeNull();
    expect(roundTrip({ ...good, path: [good.path[0], good.path[0]] })).toBeNull();
    expect(roundTrip({ ...good, history: [[999]] })).toBeNull();
    expect(roundTrip({ ...good, puzzleId: "other" })).toBeNull();
    expect(roundTrip({ ...good, backtracks: -1 })).toBeNull();
    expect(fromZipSnapshot(puzzle.id, topology, null)).toBeNull();
  });

  it("remembers a reveal in progress", () => {
    const revealing = revealZipStep(puzzle.solution, walk(4));
    expect(roundTrip(toZipSnapshot(revealing, puzzle.seed, RUNNING))?.state.revealed).toBe(true);
  });
});
