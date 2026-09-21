import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  ZIP_TIERS,
  type ZipShape,
  type ZipState,
  buildTopology,
  canUndoZip,
  checkStep,
  commitGesture,
  createZipGame,
  generateZipFromSpec,
  generateZipPuzzle,
  getZipDailyInfo,
  getZipDailyPuzzle,
  getZipHint,
  resetZip,
  revealZipStep,
  solveZip,
  stepTo,
  truncateTo,
  undoZip,
  validatePath,
  validateZipPuzzle,
  zipSeeds,
} from "@/games/zip/engine";

/**
 * 3x3, snake solution 0 1 2 5 4 3 6 7 8:
 *   1 . .
 *   . 2 .
 *   . . 3
 */
const SNAKE: ZipShape = {
  width: 3,
  height: 3,
  checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 1, column: 1 }, { number: 3, row: 2, column: 2 }],
  walls: [],
};
const SNAKE_PATH = [0, 1, 2, 5, 4, 3, 6, 7, 8];

const BULK = Number(process.env.ZIP_BULK ?? 40);

describe("rules", () => {
  const topology = buildTopology(SNAKE);

  it("starts on 1 and only there", () => {
    expect(checkStep(topology, [], 0)).toBeNull();
    expect(checkStep(topology, [], 4)?.code).toBe("start-at-one");
  });

  it("allows side neighbours only", () => {
    expect(checkStep(topology, [0], 1)).toBeNull();
    expect(checkStep(topology, [0], 4)?.code).toBe("not-adjacent");
    expect(checkStep(topology, [0, 1], 5)?.code).toBe("not-adjacent");
  });

  it("never crosses itself", () => {
    expect(checkStep(topology, [0, 1, 2, 5, 4], 1)?.code).toBe("revisit");
  });

  it("takes the numbers in order", () => {
    const skipping: ZipShape = { ...SNAKE, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 3, row: 0, column: 1 }, { number: 2, row: 2, column: 2 }] };
    const error = checkStep(buildTopology(skipping), [0], 1);
    expect(error?.code).toBe("wrong-number");
    expect(error?.message).toBe("Reach 2 before 3.");
  });

  it("respects walls in both directions", () => {
    const walled = buildTopology({ ...SNAKE, walls: [{ a: 1, b: 2 }] });
    expect(checkStep(walled, [0, 1], 2)?.code).toBe("wall");
    // Same wall, approached from the other side.
    expect(checkStep(walled, [0, 3, 6, 7, 8, 5, 2], 1)?.code).toBe("wall");
    expect(walled.neighbors[1]).not.toContain(2);
    expect(walled.neighbors[2]).not.toContain(1);
  });

  it("stops the path on the last number", () => {
    const early = buildTopology({ ...SNAKE, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 0, column: 1 }] });
    expect(checkStep(early, [0, 1], 2)?.code).toBe("path-ended");
  });

  it("validates a whole path from scratch", () => {
    expect(validatePath(topology, SNAKE_PATH)).toEqual({ complete: true, error: null, uncovered: [] });
    const partial = validatePath(topology, [0, 1, 2]);
    expect(partial.complete).toBe(false);
    expect(partial.uncovered).toHaveLength(6);
    expect(validatePath(topology, [0, 4]).error).not.toBeNull();
    expect(validatePath(topology, [0, 1, 99]).error).not.toBeNull();
  });

  it("does not accept a full board that ends on the wrong cell", () => {
    const endsElsewhere = buildTopology({ ...SNAKE, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 1, column: 1 }] });
    // Covers 8 cells and then must stop on 2 in the middle: never complete.
    expect(validatePath(endsElsewhere, [0, 1, 2, 5, 8, 7, 6, 3, 4]).complete).toBe(true);
    expect(validatePath(endsElsewhere, SNAKE_PATH).complete).toBe(false);
  });
});

describe("solver", () => {
  it("finds the snake and counts alternatives", () => {
    const result = solveZip(SNAKE, { maxSolutions: 50 });
    expect(result.exhausted).toBe(true);
    expect(result.solutions).toContainEqual(SNAKE_PATH);
    expect(result.solutionCount).toBeGreaterThan(1);
    expect(result.unique).toBe(false);
  });

  it("every solution it returns passes the rule validator", () => {
    const topology = buildTopology(SNAKE);
    for (const path of solveZip(SNAKE, { maxSolutions: 50 }).solutions) expect(validatePath(topology, path).complete).toBe(true);
  });

  it("reports no solution for an impossible board", () => {
    // 2 sits in a corner pocket that the path cannot leave again before reaching 3.
    const impossible: ZipShape = { width: 3, height: 3, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 2, column: 2 }, { number: 3, row: 0, column: 1 }], walls: [{ a: 5, b: 8 }, { a: 7, b: 8 }] };
    expect(solveZip(impossible).solutionCount).toBe(0);
  });

  it("honours a prefix and rejects an illegal one", () => {
    expect(solveZip(SNAKE, { prefix: [0, 1, 2, 5, 4, 3], maxSolutions: 10 }).solutions).toEqual([SNAKE_PATH]);
    expect(solveZip(SNAKE, { prefix: [0, 4] }).solutionCount).toBe(0);
    expect(solveZip(SNAKE, { prefix: [4] }).solutionCount).toBe(0);
  });

  it("stops on the node budget and says so, the same way every time", () => {
    const open: ZipShape = { width: 7, height: 7, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 6, column: 6 }], walls: [] };
    const first = solveZip(open, { maxSolutions: 1_000_000, maxNodes: 500 });
    const second = solveZip(open, { maxSolutions: 1_000_000, maxNodes: 500 });
    expect(first.exhausted).toBe(false);
    expect(first.unique).toBe(false);
    expect(second.nodes).toBe(first.nodes);
    expect(second.solutions).toEqual(first.solutions);
  });
});

describe("generator", () => {
  it("is deterministic", () => {
    expect(generateZipPuzzle("example-seed", "hard")).toEqual(generateZipPuzzle("example-seed", "hard"));
    expect(generateZipPuzzle(12345, "medium")).toEqual(generateZipPuzzle("12345", "medium"));
  });

  it("changes with seed, difficulty and size", () => {
    const base = JSON.stringify(generateZipPuzzle("a", "medium", { size: 6 }).solution);
    expect(JSON.stringify(generateZipPuzzle("b", "medium", { size: 6 }).solution)).not.toBe(base);
    expect(JSON.stringify(generateZipPuzzle("a", "hard", { size: 6 }).solution)).not.toBe(base);
    expect(generateZipPuzzle("a", "medium", { size: 7 }).width).toBe(7);
  });

  it("pins a known puzzle so generator changes require a version bump", () => {
    const puzzle = generateZipPuzzle("example-seed", "medium");
    expect(puzzle.seed).toBe("ZIP:example-seed:1:medium");
    expect({ size: puzzle.width, numbers: puzzle.checkpoints.length, walls: puzzle.walls.length, path: puzzle.solution.slice(0, 8) }).toMatchInlineSnapshot(`
      {
        "numbers": 4,
        "path": [
          31,
          30,
          24,
          25,
          19,
          20,
          21,
          22,
        ],
        "size": 6,
        "walls": 6,
      }
    `);
  });

  it("rejects versions and sizes it cannot build", () => {
    expect(() => generateZipFromSpec({ token: "x", version: 9, difficulty: "easy" })).toThrow(/version/i);
    expect(() => generateZipFromSpec({ token: "x", version: 1, difficulty: "easy", size: 12 })).toThrow(/size/i);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: ${BULK} puzzles are valid, unique and shaped for the tier`, () => {
      const seen = new Set<string>();
      for (let i = 0; i < BULK; i++) {
        const puzzle = generateZipPuzzle(`bulk-${difficulty}-${i}`, difficulty);
        const audit = validateZipPuzzle(puzzle);
        expect(audit.problems, puzzle.seed).toEqual([]);
        const topology = buildTopology(puzzle);
        expect(validatePath(topology, puzzle.solution).complete, puzzle.seed).toBe(true);
        expect(ZIP_TIERS[difficulty].sizes, puzzle.seed).toContain(puzzle.width);
        expect(puzzle.solution[0], puzzle.seed).toBe(topology.start);
        expect(puzzle.solution.at(-1), puzzle.seed).toBe(topology.end);
        expect(puzzle.checkpoints.length, puzzle.seed).toBeGreaterThanOrEqual(3);
        expect(puzzle.walls.length, puzzle.seed).toBeLessThanOrEqual(puzzle.width * puzzle.height * ZIP_TIERS[difficulty].maxWallShare);
        // No wall may sit on the solution path.
        const onPath = new Set(puzzle.solution.slice(1).map((cell, index) => [Math.min(cell, puzzle.solution[index]), Math.max(cell, puzzle.solution[index])].join("-")));
        expect(puzzle.walls.filter((wall) => onPath.has(`${wall.a}-${wall.b}`)), puzzle.seed).toEqual([]);
        seen.add(JSON.stringify(puzzle.solution));
      }
      expect(seen.size).toBe(BULK);
    });
  }

  it("every practice size works for every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let size = zipSeeds.minSize; size <= zipSeeds.maxSize; size++) {
        const puzzle = generateZipPuzzle("sizes", difficulty, { size });
        expect(puzzle.width).toBe(size);
        expect(validateZipPuzzle(puzzle).problems, puzzle.seed).toEqual([]);
      }
    }
  });
});

describe("game state", () => {
  const topology = buildTopology(SNAKE);
  const walk = (cells: number[], from = createZipGame("snake")) =>
    cells.reduce((state, cell) => {
      const result = stepTo(topology, state, cell);
      if (!result.ok) throw new Error(`step to ${cell} refused`);
      return result.state;
    }, from);

  it("extends, reports checkpoints, and steps back onto the previous cell", () => {
    expect(stepTo(topology, createZipGame("s"), 0)).toMatchObject({ ok: true, event: "checkpoint" });
    const state = walk([0, 1, 2]);
    expect(stepTo(topology, state, 5)).toMatchObject({ ok: true, event: "extend" });
    const back = stepTo(topology, state, 1);
    expect(back).toMatchObject({ ok: true, event: "back" });
    expect(back.state.path).toEqual([0, 1]);
  });

  it("refuses an illegal step and leaves the state untouched", () => {
    const state = walk([0, 1]);
    const result = stepTo(topology, state, 8);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("solves through the validator and then locks", () => {
    const state = walk(SNAKE_PATH);
    expect(state.status).toBe("solved");
    expect(stepTo(topology, state, 7).ok).toBe(false);
    expect(truncateTo(state, 0)).toBe(state);
    expect(resetZip(state)).toBe(state);
    expect(undoZip(state)).toBe(state);
  });

  it("counts one move per gesture and a backtrack when cells were taken back", () => {
    const first = commitGesture(walk([0, 1, 2, 5]), []);
    expect(first).toMatchObject({ moves: 1, backtracks: 0 });
    const cut = commitGesture(truncateTo(first, 1), first.path);
    expect(cut.path).toEqual([0, 1]);
    expect(cut).toMatchObject({ moves: 2, backtracks: 1 });
    expect(commitGesture(cut, cut.path)).toBe(cut);
  });

  it("undoes gesture by gesture and never mutates earlier states", () => {
    const first = commitGesture(walk([0, 1, 2]), []);
    const second = commitGesture(walk([5, 4], first), first.path);
    const frozen = JSON.stringify(first);
    const undone = undoZip(second);
    expect(undone.path).toEqual([0, 1, 2]);
    expect(undoZip(undone).path).toEqual([]);
    expect(canUndoZip(undoZip(undone))).toBe(false);
    expect(JSON.stringify(first)).toBe(frozen);
  });

  it("reset clears the path but keeps the counters", () => {
    const played = commitGesture(truncateTo(commitGesture(walk([0, 1, 2]), []), 0), [0, 1, 2]);
    const reset = resetZip(played);
    expect(reset.path).toEqual([]);
    expect(reset.history).toEqual([]);
    expect(reset).toMatchObject({ moves: 2, backtracks: 1 });
  });
});

describe("hints and reveal", () => {
  const puzzle = generateZipPuzzle("hints", "medium", { size: 6 });
  const topology = buildTopology(puzzle);

  it("walks the player to the next number along the unique solution", () => {
    const hint = getZipHint(topology, puzzle.solution, []);
    expect(hint.kind).toBe("extend");
    if (hint.kind !== "extend") return;
    expect(hint.cells).toEqual(puzzle.solution.slice(0, hint.cells.length));
    expect(topology.numberAt[hint.cells.at(-1)!]).toBe(2);
  });

  it("flags a wrong turn before anything else", () => {
    const start = puzzle.solution[0];
    const detour = topology.neighbors[start].find((cell) => cell !== puzzle.solution[1] && topology.numberAt[cell] === 0)!;
    const hint = getZipHint(topology, puzzle.solution, [start, detour]);
    expect(hint).toMatchObject({ kind: "wrong-turn", keep: 1, wrongCells: [detour] });
  });

  it("following hints alone solves every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      const target = generateZipPuzzle("hint-walk", difficulty);
      const shape = buildTopology(target);
      let state = createZipGame(target.id);
      for (let guard = 0; guard < 200 && state.status !== "solved"; guard++) {
        const hint = getZipHint(shape, target.solution, state.path);
        if (hint.kind !== "extend") throw new Error(`unexpected ${hint.kind}`);
        for (const cell of hint.cells) {
          const result = stepTo(shape, state, cell);
          expect(result.ok, target.seed).toBe(true);
          state = result.state;
        }
      }
      expect(state.status, target.seed).toBe("solved");
    }
  });

  it("reveals by cutting the wrong part first, then growing cell by cell, and locks the board", () => {
    const start = puzzle.solution[0];
    const detour = topology.neighbors[start].find((cell) => cell !== puzzle.solution[1] && topology.numberAt[cell] === 0)!;
    let state: ZipState = { ...createZipGame(puzzle.id), path: [start, detour] };
    state = revealZipStep(puzzle.solution, state);
    expect(state.path).toEqual([start]);
    expect(state.revealed).toBe(true);
    expect(stepTo(topology, state, puzzle.solution[1]).ok).toBe(false);
    let steps = 0;
    while (state.status !== "solved" && steps++ < 100) state = revealZipStep(puzzle.solution, state);
    expect(state.path).toEqual(puzzle.solution);
    expect(steps).toBe(puzzle.solution.length - 1);
  });
});

describe("daily", () => {
  it("numbers puzzles from the original game's launch day", () => {
    expect(getZipDailyInfo("2025-03-18").number).toBe(1);
    expect(getZipDailyInfo("2026-09-21").number).toBe(553);
    expect(getZipDailyInfo("2026-09-21").seed).toBe("ZIP:2026-09-21:1:easy");
  });

  it("gives every player the same puzzle for the same Pacific date", () => {
    const late = getZipDailyPuzzle(new Date("2026-09-22T06:59:00Z"));
    const early = getZipDailyPuzzle(new Date("2026-09-21T07:00:00Z"));
    expect(late.info.date).toBe("2026-09-21");
    expect(late.puzzle).toEqual(early.puzzle);
    expect(getZipDailyPuzzle(new Date("2026-09-22T07:00:00Z")).info.number).toBe(late.info.number + 1);
  });

  it("is a different puzzle from Patches on the same day, and valid for two weeks", () => {
    for (let day = 0; day < 14; day++) {
      const date = `2026-09-${String(14 + day).padStart(2, "0")}`;
      expect(validateZipPuzzle(getZipDailyPuzzle(date).puzzle).problems, date).toEqual([]);
    }
  });
});
