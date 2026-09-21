import { describe, expect, it } from "vitest";
import {
  type PuzzleShape,
  canGrowIntoLegal,
  createGame,
  extendExtentWithin,
  extentRect,
  getHint,
  isTakenByOthers,
  pendingRegionIds,
  placeRegion,
  previewRect,
  regionFromRect,
  startExtent,
  undo,
  validateState,
} from "@/games/patches/engine";
import { fromSnapshot, toSnapshot } from "@/games/patches/storage/progress";

/**
 * 5x5, solution:
 *   A A A A A      A: 5            (row 0)
 *   B B C C C      B: 4, tall      (2x2? no: 2 wide, 2 high is square, so B is 2x... see below)
 *   B B C C C
 *   D D D D D      D: 10, any shape (rows 3-4)
 *   D D D D D
 * B is "4, square" (2x2), C is "6, wide" (3x2).
 */
const puzzle: PuzzleShape & { id: string } = {
  id: "pending",
  width: 5,
  height: 5,
  clues: [
    { id: "a", row: 0, column: 4, area: 5 },
    { id: "b", row: 1, column: 0, area: 4, shape: "square" },
    { id: "c", row: 2, column: 3, area: 6, shape: "wide" },
    { id: "d", row: 4, column: 2, area: 10 },
  ],
};
const fresh = () => createGame("pending");
const put = (state: ReturnType<typeof fresh>, rect: Parameters<typeof placeRegion>[2]) => {
  const result = placeRegion(puzzle, state, rect);
  if (!result.ok) throw new Error(`refused: ${result.errors.map((error) => error.code).join(", ")}`);
  return result;
};

describe("unfinished patches", () => {
  it("keeps four cells of a 5 on the board, as pending", () => {
    const result = put(fresh(), { row: 0, column: 1, width: 4, height: 1 });
    expect(result.pending).toBe(true);
    expect(result.solved).toBe(false);
    expect(result.state.regions[0].area).toBe(4);
    expect(pendingRegionIds(puzzle, result.state)).toEqual(new Set(["region-a"]));
    expect(validateState(puzzle, result.state.regions).complete).toBe(false);
  });

  it("finishes it with a second stroke that starts anywhere on the patch", () => {
    const first = put(fresh(), { row: 0, column: 1, width: 4, height: 1 });
    // The second stroke covers only the missing cell and its neighbour. The engine adds it to the patch.
    const second = put(first.state, { row: 0, column: 0, width: 2, height: 1 });
    expect(second.pending).toBe(false);
    expect(second.region).toMatchObject({ area: 5, width: 5, height: 1 });
    expect(second.state.regions).toHaveLength(1);
    expect(second.state.redraws).toBe(0);
    expect(pendingRegionIds(puzzle, second.state).size).toBe(0);
  });

  it("lets the 10 be drawn in two strokes, as in the report", () => {
    const left = put(fresh(), { row: 3, column: 0, width: 3, height: 2 });
    expect(left.pending).toBe(true);
    const all = put(left.state, { row: 3, column: 2, width: 3, height: 2 });
    expect(all.region.area).toBe(10);
    expect(all.pending).toBe(false);
  });

  it("refuses what can never become legal: too many cells, or a shape that is already lost", () => {
    const tooMany = placeRegion(puzzle, fresh(), { row: 0, column: 0, width: 5, height: 2 });
    expect(tooMany.ok).toBe(false);
    // "6, wide" drawn 2 wide and 3 high: six cells, wrong way round, and no room left to fix it.
    const wrongWay = placeRegion(puzzle, fresh(), { row: 1, column: 3, width: 2, height: 3 });
    expect(wrongWay.ok).toBe(false);
    if (!wrongWay.ok) expect(wrongWay.errors.map((error) => error.code)).toContain("wrong-shape");
    // "4, square" as a 3x1 strip can never close into a 2x2.
    expect(placeRegion(puzzle, fresh(), { row: 1, column: 0, width: 3, height: 1 }).ok).toBe(false);
  });

  it("allows a start that matches no orientation yet, and decides once the patch is complete", () => {
    // Four cells of "6, wide" as a 2x2: neither wide nor tall so far. One more column makes it 3x2, wide.
    const square = put(fresh(), { row: 1, column: 3, width: 2, height: 2 });
    expect(square.pending).toBe(true);
    expect(put(square.state, { row: 1, column: 2, width: 2, height: 2 }).pending).toBe(false);
    // Growing it the other way gives 2x3, tall: that contradicts the clue, and the patch stays as it was.
    const refused = placeRegion(puzzle, square.state, { row: 2, column: 3, width: 2, height: 2 });
    expect(refused.ok).toBe(false);
    expect(refused.state).toBe(square.state);
  });

  it("is not pending when other patches have taken the room it would need", () => {
    // B, "4, square" at (1,0), can be rows 0-1 or rows 1-2 of columns 0-1. An unfinished D takes (2,1) and a legal A takes row 0.
    const withD = put(fresh(), { row: 2, column: 1, width: 2, height: 3 });
    expect(withD.pending).toBe(true);
    const squeezed = put(withD.state, { row: 0, column: 0, width: 5, height: 1 }).state;
    const b = puzzle.clues[1];
    const half = { row: 1, column: 0, width: 2, height: 1 };
    expect(canGrowIntoLegal(puzzle, [], b, half)).toBe(true);
    expect(canGrowIntoLegal(puzzle, squeezed.regions, b, half)).toBe(false);
    expect(previewRect(puzzle, squeezed, half).status).toBe("invalid");
    expect(placeRegion(puzzle, squeezed, half).ok).toBe(false);
  });

  it("undoes a stroke back to the unfinished patch", () => {
    const first = put(fresh(), { row: 0, column: 1, width: 4, height: 1 });
    const second = put(first.state, { row: 0, column: 0, width: 2, height: 1 });
    expect(undo(second.state).regions).toEqual(first.state.regions);
    // A stroke that touches neither a clue nor a patch belongs to nothing.
    expect(placeRegion(puzzle, first.state, { row: 2, column: 0, width: 1, height: 1 }).ok).toBe(false);
  });

  it("survives a save and reload, and a tampered one does not", () => {
    const state = put(fresh(), { row: 0, column: 1, width: 4, height: 1 }).state;
    const clock = { startedAt: 1, finishedMs: null };
    const snapshot = JSON.parse(JSON.stringify(toSnapshot(state, "seed", clock)));
    expect(fromSnapshot(puzzle, snapshot)?.state.regions).toEqual(state.regions);
    // Six cells for a 5 can never be right, so a snapshot claiming that is dropped.
    snapshot.regions[0].cells.push({ row: 1, column: 4 }, { row: 1, column: 3 });
    expect(fromSnapshot(puzzle, snapshot)).toBeNull();
  });
});

describe("hints and unfinished patches", () => {
  it("leaves an unfinished patch alone when it is on the right track, and finishes it when its turn comes", () => {
    let state = put(fresh(), { row: 0, column: 1, width: 4, height: 1 }).state;
    for (let guard = 0; guard < 6 && state.status !== "solved"; guard++) {
      const hint = getHint(puzzle, state.regions);
      expect(hint.kind).toBe("place-region");
      if (hint.kind !== "place-region") break;
      state = put(state, hint.rect).state;
    }
    expect(state.status).toBe("solved");
  });

  it("takes off an unfinished patch that reaches into another clue's cells", () => {
    // Two cells of the 10, going up into row 2, which belongs to B and C.
    const astray = put(fresh(), { row: 2, column: 2, width: 1, height: 3 }).state;
    expect(pendingRegionIds(puzzle, astray).size).toBe(1);
    expect(getHint(puzzle, astray.regions)).toMatchObject({ kind: "wrong-region", regionId: "region-d" });
  });
});

describe("a stroke stops at other clues and patches", () => {
  const taken = (others: ReturnType<typeof regionFromRect>[]) => (rect: Parameters<typeof isTakenByOthers>[3]) => !isTakenByOthers(puzzle, others, "d", rect);

  it("grows up to the edge of another clue, never over it", () => {
    // From the 10 at (4,2) the pointer goes to the top-left corner of the board, across B's clue at (1,0).
    const extent = extendExtentWithin(startExtent({ row: 4, column: 2 }), { row: 0, column: 0 }, taken([]));
    const rect = extentRect(extent);
    expect(isTakenByOthers(puzzle, [], "d", rect)).toBe(false);
    // It reaches as far as it can: all the way left, and up to row 2. Row 1 holds B's clue at (1,0), so it stops below it.
    expect(rect).toEqual({ row: 2, column: 0, width: 3, height: 3 });
  });

  it("stops at another patch too", () => {
    const b = regionFromRect("region-b", "b", { row: 1, column: 0, width: 2, height: 2 });
    const c = regionFromRect("region-c", "c", { row: 1, column: 2, width: 3, height: 2 });
    const extent = extendExtentWithin(startExtent({ row: 4, column: 2 }), { row: 0, column: 4 }, taken([b, c]));
    expect(extentRect(extent)).toEqual({ row: 3, column: 2, width: 3, height: 2 });
  });

  it("behaves like plain growth on open ground, and returns the same object when nothing changed", () => {
    const start = startExtent({ row: 4, column: 2 });
    const grown = extendExtentWithin(start, { row: 3, column: 4 }, () => true);
    expect(extentRect(grown)).toEqual({ row: 3, column: 2, width: 3, height: 2 });
    expect(extendExtentWithin(grown, { row: 4, column: 3 }, () => true)).toBe(grown);
  });
});
