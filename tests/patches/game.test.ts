import { describe, expect, it } from "vitest";
import { canUndo, createGame, isLocked, placeRegion, previewRect, recordHint, regionAt, regionFromRect, removeRegionAt, resetGame, revealStep, undo } from "@/games/patches/engine";
import { QUADRANT_RECTS, quadrants } from "./fixtures";

const puzzle = quadrants();
const fresh = () => createGame("quadrants");
const place = (state: ReturnType<typeof fresh>, id: keyof typeof QUADRANT_RECTS) => {
  const result = placeRegion(puzzle, state, QUADRANT_RECTS[id]);
  if (!result.ok) throw new Error(`placement of ${id} failed`);
  return result.state;
};

describe("placing and removing", () => {
  it("places a legal patch and links it to its clue", () => {
    const result = placeRegion(puzzle, fresh(), QUADRANT_RECTS.a);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.region.clueId).toBe("a");
    expect(result.state.moves).toBe(1);
    expect(result.solved).toBe(false);
  });

  it("refuses an illegal patch and leaves the state untouched", () => {
    const state = place(fresh(), "a");
    const result = placeRegion(puzzle, state, { row: 0, column: 1, width: 3, height: 2 });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain("overlap");
  });

  it("previews neutral, valid and invalid rectangles", () => {
    const state = place(fresh(), "a");
    expect(previewRect(puzzle, state, { row: 1, column: 2, width: 1, height: 1 }).status).toBe("neutral");
    expect(previewRect(puzzle, state, QUADRANT_RECTS.b).status).toBe("valid");
    expect(previewRect(puzzle, state, { row: 0, column: 2, width: 2, height: 1 }).status).toBe("invalid");
    expect(previewRect(puzzle, state, { row: 0, column: 1, width: 1, height: 1 }).status).toBe("invalid");
  });

  it("removes the patch under a tapped cell and counts a redraw", () => {
    const state = removeRegionAt(place(fresh(), "a"), { row: 1, column: 1 });
    expect(state.regions).toHaveLength(0);
    expect(state.redraws).toBe(1);
    expect(regionAt(state, { row: 1, column: 1 })).toBeNull();
  });

  it("ignores a tap on an empty cell", () => {
    const state = place(fresh(), "a");
    expect(removeRegionAt(state, { row: 3, column: 3 })).toBe(state);
  });

  it("detects completion through the validator and then locks the board", () => {
    let state = fresh();
    for (const id of ["a", "b", "c"] as const) state = place(state, id);
    expect(state.status).toBe("playing");
    const last = placeRegion(puzzle, state, QUADRANT_RECTS.d);
    expect(last.ok && last.solved).toBe(true);
    const solved = last.state;
    expect(solved.status).toBe("solved");
    expect(removeRegionAt(solved, { row: 0, column: 0 })).toBe(solved);
    expect(undo(solved)).toBe(solved);
    expect(resetGame(solved)).toBe(solved);
    expect(recordHint(solved)).toBe(solved);
  });
});

describe("undo", () => {
  it("reverts a placement", () => {
    const before = place(fresh(), "a");
    const after = undo(place(before, "b"));
    expect(after.regions).toEqual(before.regions);
    expect(after.history).toEqual(before.history);
    expect(after.redraws).toBe(1);
  });

  it("reverts a removal by restoring the exact patch", () => {
    const placed = place(fresh(), "a");
    const restored = undo(removeRegionAt(placed, { row: 0, column: 0 }));
    expect(restored.regions).toEqual(placed.regions);
    expect(restored.redraws).toBe(1);
  });

  it("walks back through a mixed history to the empty board", () => {
    let state = place(place(fresh(), "a"), "b");
    state = removeRegionAt(state, { row: 0, column: 0 });
    state = place(state, "c");
    while (canUndo(state)) state = undo(state);
    expect(state.regions).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it("is a no-op on an empty history and never mutates earlier states", () => {
    const empty = fresh();
    expect(undo(empty)).toBe(empty);
    const first = place(empty, "a");
    const snapshot = JSON.stringify(first);
    undo(place(first, "b"));
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(empty.regions).toEqual([]);
  });
});

describe("reset", () => {
  it("clears patches and history but keeps identity and counters", () => {
    let state = recordHint(place(place(fresh(), "a"), "b"));
    state = removeRegionAt(state, { row: 0, column: 0 });
    const reset = resetGame(state);
    expect(reset.regions).toEqual([]);
    expect(reset.history).toEqual([]);
    expect(canUndo(reset)).toBe(false);
    expect(reset.puzzleId).toBe("quadrants");
    expect(reset.hintsUsed).toBe(1);
    expect(reset.redraws).toBe(1);
    expect(reset.moves).toBe(2);
    expect(reset.status).toBe("playing");
  });
});

describe("revealing the solution", () => {
  const solution = (["a", "b", "c", "d"] as const).map((id) => regionFromRect(`region-${id}`, id, QUADRANT_RECTS[id]));

  it("locks the board from the first step and drops the undo history", () => {
    const step = revealStep(solution, place(fresh(), "a"));
    expect(step.state.revealed).toBe(true);
    expect(isLocked(step.state)).toBe(true);
    expect(step.state.history).toEqual([]);
    expect(placeRegion(puzzle, step.state, QUADRANT_RECTS.c).ok).toBe(false);
    expect(removeRegionAt(step.state, { row: 0, column: 0 })).toBe(step.state);
  });

  it("takes wrong patches off before it places anything", () => {
    const loose = quadrants({ a: { area: undefined, shape: undefined } });
    const wrong = placeRegion(loose, fresh(), { row: 0, column: 0, width: 1, height: 2 });
    if (!wrong.ok) throw new Error("fixture");
    const first = revealStep(solution, wrong.state);
    expect(first.change).toMatchObject({ type: "remove" });
    expect(first.state.regions).toEqual([]);
  });

  it("places one patch per step, in order, and ends solved without counting moves", () => {
    let state = place(fresh(), "b");
    const placed: string[] = [];
    for (let guard = 0; guard < 10 && state.status !== "solved"; guard++) {
      const step = revealStep(solution, state);
      if (step.change?.type === "place") placed.push(step.change.region.clueId);
      state = step.state;
    }
    expect(placed).toEqual(["a", "c", "d"]);
    expect(state.status).toBe("solved");
    expect(state.moves).toBe(1);
    expect(revealStep(solution, state).change).toBeNull();
  });
});
