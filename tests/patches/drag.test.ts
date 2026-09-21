import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  canUndo,
  createGame,
  extendExtent,
  extentIsSingleCell,
  extentRect,
  placeRegion,
  regionFromRect,
  startExtent,
  undo,
  validateState,
} from "@/games/patches/engine";
import { fromSnapshot, toSnapshot } from "@/games/patches/storage/progress";
import { REAL_188, REAL_188_SOLUTION, quadrants } from "./fixtures";

const drag = (anchor: [number, number], ...path: [number, number][]) =>
  path.reduce((extent, [row, column]) => extendExtent(extent, { row, column }), startExtent({ row: anchor[0], column: anchor[1] }));

describe("clue-anchored drag", () => {
  it("starts as the clue cell alone", () => {
    const extent = startExtent({ row: 1, column: 1 });
    expect(extentRect(extent)).toEqual({ row: 1, column: 1, width: 1, height: 1 });
    expect(extentIsSingleCell(extent)).toBe(true);
  });

  it("keeps the rows above when the pointer comes back down past the clue", () => {
    // The reported case: a 6 in the middle row of its 2x3 patch. Up-left first, then down.
    const extent = drag([1, 1], [0, 0], [1, 0], [2, 0]);
    expect(extentRect(extent)).toEqual({ row: 0, column: 0, width: 2, height: 3 });
  });

  it("keeps cells on a straight line through the clue, where no detour exists", () => {
    const extent = drag([2, 0], [1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0]);
    expect(extentRect(extent)).toEqual({ row: 0, column: 0, width: 1, height: 5 });
  });

  it("never shrinks during a drag and always contains the clue", () => {
    const extent = drag([3, 3], [0, 5], [3, 3], [4, 2]);
    expect(extentRect(extent)).toEqual({ row: 0, column: 2, width: 4, height: 5 });
    expect(extent.anchor).toEqual({ row: 3, column: 3 });
  });

  it("is a bounding box, so a fast pointer that skips cells changes nothing", () => {
    expect(extentRect(drag([1, 1], [4, 5]))).toEqual(extentRect(drag([1, 1], [2, 2], [3, 3], [4, 4], [4, 5])));
  });

  it("returns the same object when nothing grew", () => {
    const extent = drag([1, 1], [0, 0]);
    expect(extendExtent(extent, { row: 1, column: 0 })).toBe(extent);
  });
});

describe("legal but wrong patches stay on the board", () => {
  it("keeps a patch that obeys its clue even though no solution contains it", () => {
    // Clue b of puzzle #188 is numberless, so a 2x1 is legal. The answer is 2x5.
    const wrong = { row: 1, column: 0, width: 2, height: 1 };
    expect(wrong).not.toEqual(REAL_188_SOLUTION[1]);
    const result = placeRegion(REAL_188, createGame("real"), wrong);
    expect(result.ok).toBe(true);
    expect(result.state.regions).toHaveLength(1);
    expect(validateState(REAL_188, result.state.regions).consistent).toBe(true);
  });

  it("still refuses patches that can never be right", () => {
    const state = createGame("real");
    expect(placeRegion(REAL_188, state, { row: 0, column: 1, width: 2, height: 2 }).ok).toBe(false); // three clues
    expect(placeRegion(quadrants(), createGame("q"), { row: 0, column: 0, width: 3, height: 1 }).ok).toBe(false); // "4, square" cannot be 3 wide
  });
});

describe("drawing a patch in several strokes", () => {
  const puzzle = quadrants({ a: { area: undefined, shape: undefined } });
  const small = { row: 0, column: 0, width: 1, height: 2 };
  const big = { row: 0, column: 0, width: 2, height: 2 };

  const placed = () => {
    const first = placeRegion(puzzle, createGame("q"), small);
    if (!first.ok) throw new Error("fixture");
    return first.state;
  };

  it("grows the clue's patch in one action, and growing is not a redraw", () => {
    const result = placeRegion(puzzle, placed(), big);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replaced?.area).toBe(2);
    expect(result.state.regions).toHaveLength(1);
    expect(result.state.regions[0].area).toBe(4);
    expect(result.state.redraws).toBe(0);
    expect(result.state.history.at(-1)?.type).toBe("replace");
  });

  it("undoes a replacement in a single step, back to the earlier patch", () => {
    const before = placed();
    const replaced = placeRegion(puzzle, before, big);
    if (!replaced.ok) throw new Error("fixture");
    const after = undo(replaced.state);
    expect(after.regions).toEqual(before.regions);
    expect(after.history).toEqual(before.history);
    expect(canUndo(after)).toBe(true);
  });

  it("treats drawing the identical patch again as nothing", () => {
    const before = placed();
    const result = placeRegion(puzzle, before, small);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
    if (!result.ok) expect(result.errors).toEqual([]);
  });

  it("still refuses a redraw that overlaps another clue's patch", () => {
    const loose = quadrants({ a: { area: undefined, shape: undefined }, c: { area: undefined, shape: undefined } });
    let state = createGame("q");
    for (const rect of [small, { row: 2, column: 0, width: 2, height: 2 }]) {
      const step = placeRegion(loose, state, rect);
      if (!step.ok) throw new Error("fixture");
      state = step.state;
    }
    const result = placeRegion(loose, state, { row: 0, column: 0, width: 1, height: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain("overlap");
  });

  it("survives a save and reload with its undo history intact", () => {
    const withId = { ...puzzle, id: "q" };
    const replaced = placeRegion(puzzle, placed(), big);
    if (!replaced.ok) throw new Error("fixture");
    const restored = fromSnapshot(withId, JSON.parse(JSON.stringify(toSnapshot(replaced.state, "seed", { startedAt: 1_000, finishedMs: null }))));
    expect(restored?.state).toEqual(replaced.state);
    expect(undo(restored!.state).regions[0].area).toBe(2);
  });

  it("rejects a stored replace action that lost its previous patch", () => {
    const replaced = placeRegion(puzzle, placed(), big);
    if (!replaced.ok) throw new Error("fixture");
    const snapshot = JSON.parse(JSON.stringify(toSnapshot(replaced.state, "seed", { startedAt: 1_000, finishedMs: null })));
    delete snapshot.history.at(-1).previous;
    expect(fromSnapshot({ ...puzzle, id: "q" }, snapshot)).toBeNull();
  });
});

describe("regionFromRect sanity for the drag path", () => {
  it("builds the reported 2x3 patch around a middle-row clue", () => {
    const region = regionFromRect("region-x", "x", extentRect(drag([1, 1], [0, 0], [2, 0])));
    expect(region).toMatchObject({ area: 6, width: 2, height: 3, shape: "tall" });
  });
});
