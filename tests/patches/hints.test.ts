import { describe, expect, it } from "vitest";
import { createGame, generatePuzzle, getHint, placeRegion, rectEquals, regionFromRect, regionRect, validateState } from "@/games/patches/engine";
import { REAL_188, REAL_188_SOLUTION } from "./fixtures";

describe("hints", () => {
  it("points at a patch from the real solution and explains why", () => {
    const hint = getHint(REAL_188, []);
    expect(hint.kind).toBe("place-region");
    if (hint.kind !== "place-region") return;
    const index = REAL_188.clues.findIndex((clue) => clue.id === hint.clueId);
    expect(hint.rect).toEqual(REAL_188_SOLUTION[index]);
    expect(hint.cells).toHaveLength(hint.rect.width * hint.rect.height);
    expect(hint.message.length).toBeGreaterThan(20);
  });

  it("flags a legal but wrong patch before suggesting anything", () => {
    // Clue b is numberless, so a 2x1 patch is legal. It is not part of the solution.
    const wrong = regionFromRect("region-b", "b", { row: 1, column: 0, width: 2, height: 1 });
    const hint = getHint(REAL_188, [wrong]);
    expect(hint.kind).toBe("wrong-region");
    if (hint.kind === "wrong-region") expect(hint.regionId).toBe("region-b");
  });

  it("finds the wrong patch among correct ones", () => {
    const good = regionFromRect("region-a", "a", REAL_188_SOLUTION[0]);
    const bad = regionFromRect("region-f", "f", { row: 5, column: 3, width: 2, height: 1 });
    const hint = getHint(REAL_188, [good, bad]);
    expect(hint).toMatchObject({ kind: "wrong-region", regionId: "region-f" });
  });

  it("reports completion on a solved board", () => {
    const regions = REAL_188.clues.map((clue, i) => regionFromRect(`region-${clue.id}`, clue.id, REAL_188_SOLUTION[i]));
    expect(getHint(REAL_188, regions).kind).toBe("complete");
  });

  it("following hints alone solves generated puzzles of every tier", () => {
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      for (let i = 0; i < 12; i++) {
        const puzzle = generatePuzzle(`hint-walk-${i}`, difficulty);
        let state = createGame(puzzle.id);
        for (let step = 0; step < puzzle.clues.length; step++) {
          const hint = getHint(puzzle, state.regions);
          expect(hint.kind, puzzle.seed).toBe("place-region");
          if (hint.kind !== "place-region") break;
          const truth = puzzle.solution.find((region) => region.clueId === hint.clueId)!;
          expect(rectEquals(hint.rect, regionRect(truth)), puzzle.seed).toBe(true);
          const placed = placeRegion(puzzle, state, hint.rect);
          expect(placed.ok, puzzle.seed).toBe(true);
          state = placed.state;
        }
        expect(state.status, puzzle.seed).toBe("solved");
        expect(validateState(puzzle, state.regions).complete).toBe(true);
      }
    }
  });
});
