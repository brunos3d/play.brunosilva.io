import { describe, expect, it } from "vitest";
import {
  boundingRect,
  buildRegion,
  classifyShape,
  clueAccepts,
  describeClue,
  isFilledRectangle,
  rectCells,
  rectFromCorners,
  rectsOverlap,
  regionFromRect,
  shapeAccepts,
  validateRegion,
  validateState,
} from "@/games/patches/engine";
import { QUADRANT_RECTS, quadrants } from "./fixtures";

describe("region geometry", () => {
  it("builds the same rectangle from corners in any order", () => {
    const expected = { row: 1, column: 2, width: 3, height: 2 };
    expect(rectFromCorners({ row: 1, column: 2 }, { row: 2, column: 4 })).toEqual(expected);
    expect(rectFromCorners({ row: 2, column: 4 }, { row: 1, column: 2 })).toEqual(expected);
    expect(rectFromCorners({ row: 2, column: 2 }, { row: 1, column: 4 })).toEqual(expected);
  });

  it("derives area, size and shape from cells", () => {
    const region = regionFromRect("r", "c", { row: 0, column: 0, width: 2, height: 4 });
    expect(region).toMatchObject({ area: 8, width: 2, height: 4, shape: "tall" });
    expect(regionFromRect("r", "c", { row: 0, column: 0, width: 3, height: 1 }).shape).toBe("wide");
    expect(regionFromRect("r", "c", { row: 0, column: 0, width: 3, height: 3 }).shape).toBe("square");
    expect(regionFromRect("r", "c", { row: 5, column: 5, width: 1, height: 1 }).shape).toBe("square");
  });

  it("flags L shapes, holes, duplicates and disconnected cells as irregular", () => {
    const lShape = [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }];
    const disconnected = [{ row: 0, column: 0 }, { row: 0, column: 2 }];
    const duplicated = [{ row: 0, column: 0 }, { row: 0, column: 0 }];
    for (const cells of [lShape, disconnected, duplicated]) {
      expect(isFilledRectangle(cells)).toBe(false);
      expect(classifyShape(cells)).toBe("irregular");
    }
    expect(buildRegion("r", "c", lShape).area).toBe(3);
    expect(boundingRect(lShape)).toEqual({ row: 0, column: 0, width: 2, height: 2 });
  });

  it("detects overlap only when cells are shared", () => {
    const a = { row: 0, column: 0, width: 2, height: 2 };
    expect(rectsOverlap(a, { row: 1, column: 1, width: 2, height: 2 })).toBe(true);
    expect(rectsOverlap(a, { row: 0, column: 2, width: 2, height: 2 })).toBe(false);
    expect(rectsOverlap(a, { row: 2, column: 0, width: 2, height: 2 })).toBe(false);
  });
});

describe("clue constraints", () => {
  it("uses strict inequalities for tall and wide", () => {
    expect(shapeAccepts("tall", 2, 4)).toBe(true);
    expect(shapeAccepts("tall", 1, 2)).toBe(true);
    expect(shapeAccepts("tall", 3, 3)).toBe(false);
    expect(shapeAccepts("tall", 4, 2)).toBe(false);
    expect(shapeAccepts("wide", 4, 2)).toBe(true);
    expect(shapeAccepts("wide", 3, 3)).toBe(false);
    expect(shapeAccepts("square", 3, 3)).toBe(true);
    expect(shapeAccepts("square", 1, 1)).toBe(true);
    expect(shapeAccepts("square", 2, 3)).toBe(false);
  });

  it("treats freeform, unconstrained and missing as any rectangle", () => {
    for (const shape of ["freeform", "unconstrained", undefined] as const) {
      expect(shapeAccepts(shape, 1, 5)).toBe(true);
      expect(shapeAccepts(shape, 5, 1)).toBe(true);
      expect(shapeAccepts(shape, 2, 2)).toBe(true);
    }
  });

  it("combines number and shape", () => {
    const clue = { id: "x", row: 0, column: 0, area: 6, shape: "wide" as const };
    expect(clueAccepts(clue, 3, 2)).toBe(true);
    expect(clueAccepts(clue, 6, 1)).toBe(true);
    expect(clueAccepts(clue, 2, 3)).toBe(false);
    expect(clueAccepts(clue, 4, 2)).toBe(false);
  });

  it("describes clues in plain language", () => {
    expect(describeClue({ id: "x", row: 0, column: 0, area: 6, shape: "wide" })).toBe("a wide rectangle of 6 cells");
    expect(describeClue({ id: "x", row: 0, column: 0, area: 4 })).toBe("4 cells, any rectangle");
    expect(describeClue({ id: "x", row: 0, column: 0, shape: "tall" })).toBe("a tall rectangle of unknown size");
    expect(describeClue({ id: "x", row: 0, column: 0, shape: "freeform" })).toBe("unknown size, any rectangle");
  });
});

describe("validateRegion", () => {
  const puzzle = quadrants();
  const codes = (rect: Parameters<typeof rectCells>[0], clueId: string, placed = [] as ReturnType<typeof regionFromRect>[]) =>
    validateRegion(puzzle, placed, regionFromRect(`region-${clueId}`, clueId, rect)).errors.map((error) => error.code);

  it("accepts a correct patch", () => {
    expect(codes(QUADRANT_RECTS.a, "a")).toEqual([]);
  });

  it("rejects a patch without a clue", () => {
    expect(codes({ row: 1, column: 1, width: 2, height: 2 }, "")).toEqual(["no-clue"]);
  });

  it("rejects a patch with two clues", () => {
    expect(codes({ row: 0, column: 0, width: 4, height: 1 }, "a")).toContain("multiple-clues");
  });

  it("rejects wrong area and wrong shape separately", () => {
    expect(codes({ row: 0, column: 0, width: 3, height: 3 }, "a")).toEqual(["wrong-area"]);
    expect(codes({ row: 0, column: 0, width: 1, height: 2 }, "a")).toEqual(["wrong-area", "wrong-shape"]);
    const numberOnly = quadrants({ a: { shape: undefined } });
    const tallFour = regionFromRect("region-a", "a", { row: 0, column: 0, width: 1, height: 4 });
    expect(validateRegion(numberOnly, [], tallFour).errors.map((e) => e.code)).toEqual(["multiple-clues"]);
  });

  it("rejects overlap with a placed patch but ignores itself", () => {
    const placed = [regionFromRect("region-a", "a", QUADRANT_RECTS.a)];
    expect(codes({ row: 0, column: 1, width: 3, height: 2 }, "b", placed)).toContain("overlap");
    expect(validateRegion(puzzle, placed, placed[0]).ok).toBe(true);
  });

  it("rejects out-of-bounds and non-rectangular cell sets", () => {
    expect(codes({ row: 3, column: 3, width: 2, height: 2 }, "d")).toEqual(["out-of-bounds"]);
    const lShape = { id: "region-a", clueId: "a", cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }] };
    expect(validateRegion(puzzle, [], lShape).errors.map((e) => e.code)).toContain("not-rectangle");
  });

  it("recomputes area instead of trusting cached fields", () => {
    const forged = { ...regionFromRect("region-a", "a", { row: 0, column: 0, width: 3, height: 1 }), area: 4, width: 2, height: 2, shape: "square" as const };
    expect(validateRegion(puzzle, [], forged).ok).toBe(false);
  });

  it("rejects a patch linked to the wrong clue", () => {
    expect(codes(QUADRANT_RECTS.a, "b")).toEqual(["clue-mismatch"]);
  });
});

describe("validateState", () => {
  const puzzle = quadrants();
  const all = (["a", "b", "c", "d"] as const).map((id) => regionFromRect(`region-${id}`, id, QUADRANT_RECTS[id]));

  it("accepts the full solution", () => {
    const result = validateState(puzzle, all);
    expect(result.complete).toBe(true);
    expect(result.uncoveredCells).toEqual([]);
  });

  it("reports gaps", () => {
    const result = validateState(puzzle, all.slice(0, 3));
    expect(result.complete).toBe(false);
    expect(result.consistent).toBe(true);
    expect(result.uncoveredCells).toHaveLength(4);
    expect(result.unusedClueIds).toEqual(["d"]);
  });

  it("reports overlaps", () => {
    const wide = regionFromRect("region-b", "b", { row: 0, column: 1, width: 3, height: 2 });
    const result = validateState(quadrants({ b: { area: 6, shape: "wide" } }), [all[0], wide]);
    expect(result.consistent).toBe(false);
    expect(result.overlappingCells).toEqual([{ row: 0, column: 1 }, { row: 1, column: 1 }]);
  });

  it("is not fooled by a board that only looks full", () => {
    // Four patches cover all 16 cells, but clue areas say 4 each and these are 8, 8... with clues shared.
    const halves = [
      regionFromRect("region-a", "a", { row: 0, column: 0, width: 4, height: 2 }),
      regionFromRect("region-c", "c", { row: 2, column: 0, width: 4, height: 2 }),
    ];
    const result = validateState(puzzle, halves);
    expect(result.uncoveredCells).toEqual([]);
    expect(result.complete).toBe(false);
  });

  it("an empty board is consistent but not complete", () => {
    const result = validateState(puzzle, []);
    expect(result.consistent).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.uncoveredCells).toHaveLength(16);
  });
});
