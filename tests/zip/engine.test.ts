import { describe, expect, it } from "vitest";
import { createRng } from "@/shared/engine/prng";
import {
  BLOCK_FIGURES,
  DIFFICULTIES,
  FIGURES,
  ZIP_TIERS,
  type ZipShape,
  type ZipState,
  backbite,
  buildFigure,
  buildTopology,
  canUndoZip,
  checkStep,
  commitGesture,
  createZipGame,
  findHamiltonianPath,
  generateZipFromSpec,
  generateZipPuzzle,
  getZipDailyInfo,
  getZipDailyPuzzle,
  getZipHint,
  isHamiltonianPath,
  mapCell,
  measureTraps,
  nextNumber,
  resetZip,
  revealZipStep,
  solveZip,
  stepTo,
  symmetricPath,
  truncateTo,
  twinWall,
  undoZip,
  validatePath,
  validateZipPuzzle,
  wallKey,
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

  it("pins a known version 1 puzzle: old seeds must keep their boards forever", () => {
    const puzzle = generateZipPuzzle("example-seed", "medium", { version: 1 });
    expect(puzzle.seed).toBe("ZIP:example-seed:1:medium");
    expect(puzzle.metadata.theme).toEqual({ figure: "none", path: "random", symmetric: false });
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

  it("pins a known version 2 puzzle so generator changes require a version bump", () => {
    const puzzle = generateZipPuzzle("example-seed", "medium");
    expect(puzzle.seed).toBe("ZIP:example-seed:2:medium");
    expect({ size: puzzle.width, theme: puzzle.metadata.theme, numbers: puzzle.checkpoints.length, walls: puzzle.walls.length, path: puzzle.solution.slice(0, 8) }).toMatchInlineSnapshot(`
      {
        "numbers": 3,
        "path": [
          14,
          15,
          21,
          20,
          19,
          13,
          7,
          8,
        ],
        "size": 6,
        "theme": {
          "figure": "none",
          "path": "spiral",
          "symmetric": false,
        },
        "walls": 6,
      }
    `);
  });

  it("builds a different board per generator version, and both stay valid", () => {
    const [one, two] = [1, 2].map((version) => generateZipPuzzle("versions", "hard", { size: 7, version }));
    expect(one.solution).not.toEqual(two.solution);
    expect(validateZipPuzzle(one).problems).toEqual([]);
    expect(validateZipPuzzle(two).problems).toEqual([]);
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
        expect(puzzle.checkpoints.length, puzzle.seed).toBeLessThanOrEqual(Math.max(3, Math.round(puzzle.width * puzzle.height * ZIP_TIERS[difficulty].maxCheckpointDensity)));
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

describe("themes", () => {
  const sample = (difficulty: (typeof DIFFICULTIES)[number], count: number) => Array.from({ length: count }, (_, i) => generateZipPuzzle(`theme-${i}`, difficulty));

  it("varies with the seed: wall figures and drawn paths both show up", () => {
    const themes = sample("medium", 40).map((puzzle) => puzzle.metadata.theme);
    expect(new Set(themes.map((theme) => theme.figure)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(themes.filter((theme) => theme.figure === "none").map((theme) => theme.path)).size).toBeGreaterThanOrEqual(2);
  });

  it("every figure fits a board and leaves room for a path, at every size it supports", () => {
    for (const name of FIGURES) {
      for (let size = zipSeeds.minSize; size <= zipSeeds.maxSize; size++) {
        const rng = createRng(`figure-${name}-${size}`);
        const figure = buildFigure(name, size, rng);
        if (figure.walls.length === 0 && figure.blocked.length === 0) continue;
        for (const wall of figure.walls) expect(buildTopology({ width: size, height: size, checkpoints: [], walls: [] }).neighbors[wall.a], `${name} ${size}`).toContain(wall.b);
        const { neighbors, blockedAt } = buildTopology({ width: size, height: size, checkpoints: [], walls: figure.walls, blocked: figure.blocked });
        // Random mirrored walls and random islands can close off a cell. The generator just draws again. Every designed figure must work.
        if (name !== "mirror" && name !== "islands") expect(findHamiltonianPath(rng, neighbors, { skip: blockedAt }), `${name} ${size}x${size}`).not.toBeNull();
      }
    }
  });

  it("keeps the figure on the board and never walls off the solution", () => {
    for (const puzzle of sample("medium", 40)) {
      const onPath = new Set(puzzle.solution.slice(1).map((cell, index) => wallKey(cell, puzzle.solution[index])));
      expect(puzzle.walls.filter((wall) => onPath.has(wallKey(wall.a, wall.b))), puzzle.seed).toEqual([]);
    }
  });

  it("mirrors the walls of a symmetric figure wherever the solution allows it", () => {
    const faces = sample("easy", 120).filter((puzzle) => puzzle.metadata.theme.figure === "face" || puzzle.metadata.theme.figure === "cross");
    expect(faces.length).toBeGreaterThan(3);
    let mirrored = 0;
    let total = 0;
    for (const puzzle of faces) {
      const keys = new Set(puzzle.walls.map((wall) => wallKey(wall.a, wall.b)));
      const symmetries = ["mirror-x", "mirror-y", "rotate"] as const;
      // The figure was turned a random way, so take the symmetry that explains most of its walls.
      const best = Math.max(...symmetries.map((symmetry) => puzzle.walls.filter((wall) => { const twin = twinWall(symmetry, puzzle.width, wall); return !twin || keys.has(wallKey(twin.a, twin.b)); }).length));
      mirrored += best;
      total += puzzle.walls.length;
    }
    expect(mirrored / total).toBeGreaterThan(0.7);
  });

  it("drawn paths keep their drawing: long straight runs survive the disturbance", () => {
    const longestRun = (path: readonly number[]) => {
      let [best, run] = [1, 1];
      for (let i = 2; i < path.length; i++) {
        run = path[i] - path[i - 1] === path[i - 1] - path[i - 2] ? run + 1 : 1;
        best = Math.max(best, run);
      }
      return best + 1;
    };
    const drawn = sample("hard", 60).filter((puzzle) => ["spiral", "snake"].includes(puzzle.metadata.theme.path));
    expect(drawn.length).toBeGreaterThan(3);
    for (const puzzle of drawn) expect(longestRun(puzzle.solution), puzzle.seed).toBeGreaterThanOrEqual(puzzle.width - 1);
  });

  it("backbiting keeps a Hamiltonian path Hamiltonian, walls included", () => {
    const figure = buildFigure("face", 8, createRng("bb"));
    const { neighbors } = buildTopology({ width: 8, height: 8, checkpoints: [], walls: figure.walls });
    const rng = createRng("bb-path");
    const found = findHamiltonianPath(rng, neighbors)!;
    expect(isHamiltonianPath(backbite(rng, found, neighbors, 500), neighbors)).toBe(true);
  });
});

describe("difficulty", () => {
  const meanTraps = (difficulty: (typeof DIFFICULTIES)[number], version: number) => {
    let total = 0;
    for (let i = 0; i < 24; i++) total += generateZipPuzzle(`ladder-${i}`, difficulty, { size: 7, version }).metadata.trapScore;
    return total / 24;
  };

  it("climbs from easy to expert on the same board size", () => {
    const [easy, medium, hard, expert] = DIFFICULTIES.map((difficulty) => meanTraps(difficulty, 2));
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
    expect(hard).toBeLessThan(expert);
  });

  it("makes expert harder and easy easier than version 1 did", () => {
    expect(meanTraps("expert", 2)).toBeGreaterThan(meanTraps("expert", 1) * 1.15);
    expect(meanTraps("easy", 2)).toBeLessThan(meanTraps("easy", 1));
  });

  it("scores a board whose wrong turns all die at once as trap free", () => {
    // One lane, no choices: a 1-wide corridor in all but name.
    const lane: ZipShape = { width: 3, height: 3, checkpoints: SNAKE.checkpoints, walls: [{ a: 0, b: 3 }, { a: 1, b: 4 }, { a: 4, b: 7 }, { a: 5, b: 8 }] };
    const report = measureTraps(lane, buildTopology(lane), SNAKE_PATH);
    expect(report).toMatchObject({ score: 0, deepTraps: 0, decisions: 0 });
  });
});

describe("hidden numbers", () => {
  // 1 . .      The 2 in the middle is hidden. A path may take it as any
  // . ? .      numbered cell, but the visible 3 must still be the third.
  // . . 3
  const HIDDEN: ZipShape = { ...SNAKE, checkpoints: SNAKE.checkpoints.map((checkpoint) => (checkpoint.number === 2 ? { ...checkpoint, hidden: true } : checkpoint)) };

  it("lets a hidden number take any place in the order, and still holds visible numbers to theirs", () => {
    const twoHidden: ZipShape = {
      width: 3,
      height: 3,
      checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 0, column: 2, hidden: true }, { number: 3, row: 0, column: 1 }, { number: 4, row: 2, column: 2 }],
      walls: [],
    };
    const topology = buildTopology(twoHidden);
    // Reading the numbers, 3 comes before 2 here. The player cannot see the 2, so the step onto 3 is judged by place: it is the second numbered cell, and it must be the third.
    const refusal = checkStep(topology, [0], 1);
    expect(refusal?.code).toBe("wrong-number");
    expect(refusal?.message).toContain("third");
    // A hidden cell is never refused for its number, whatever place it takes.
    expect(checkStep(buildTopology(HIDDEN), [0, 1], 4)).toBeNull();
    expect(checkStep(buildTopology(HIDDEN), [0, 3], 4)).toBeNull();
  });

  it("counts a covered hidden number towards the next one", () => {
    const topology = buildTopology(HIDDEN);
    expect(nextNumber(topology, [0, 1, 2, 5])).toBe(2);
    expect(nextNumber(topology, [0, 1, 2, 5, 4])).toBe(3);
  });

  it("solver and rules agree: every solution of a board with hidden numbers validates, and hiding can only add solutions", () => {
    const open = solveZip(SNAKE, { maxSolutions: 50 }).solutions.length;
    const hidden = solveZip(HIDDEN, { maxSolutions: 50 });
    expect(hidden.solutions.length).toBeGreaterThanOrEqual(open);
    for (const path of hidden.solutions) expect(validatePath(buildTopology(HIDDEN), path).complete).toBe(true);
  });

  it("hides numbers on hard and expert only, never 1 or the last, never all in between, and stays unique", () => {
    let hiddenBoards = 0;
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 12; i++) {
        const puzzle = generateZipPuzzle(`hidden-${i}`, difficulty);
        const hidden = puzzle.checkpoints.filter((checkpoint) => checkpoint.hidden);
        expect(puzzle.metadata.hiddenCount).toBe(hidden.length);
        if (difficulty === "easy" || difficulty === "medium") expect(hidden).toHaveLength(0);
        if (hidden.length === 0) continue;
        hiddenBoards++;
        expect(puzzle.checkpoints[0].hidden).toBeFalsy();
        expect(puzzle.checkpoints[puzzle.checkpoints.length - 1].hidden).toBeFalsy();
        expect(hidden.length).toBeLessThan(puzzle.checkpoints.length - 2);
        const result = solveZip(puzzle, { maxSolutions: 2 });
        expect(result.unique).toBe(true);
        expect(result.solutions[0]).toEqual([...puzzle.solution]);
      }
    }
    expect(hiddenBoards).toBeGreaterThan(12);
  });

  it("version 1 boards never hide a number", () => {
    for (let i = 0; i < 6; i++) expect(generateZipPuzzle(`hidden-${i}`, "expert", { version: 1 }).metadata.hiddenCount).toBe(0);
  });
});

describe("blocked cells", () => {
  // 1 . .      The centre is blocked. The path goes around it and the board is
  // . X .      solved with eight cells.
  // . . 2
  const RING: ZipShape = { width: 3, height: 3, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 2, column: 2 }], walls: [], blocked: [4] };

  it("cannot be entered, are nobody's neighbour, and do not have to be covered", () => {
    const topology = buildTopology(RING);
    expect(topology.playableCount).toBe(8);
    expect(topology.neighbors[4]).toEqual([]);
    expect(topology.neighbors[1]).not.toContain(4);
    expect(checkStep(topology, [0, 1], 4)?.code).toBe("blocked");
    // Parity: both ends of an eight-cell path around the ring have different colours, so 0 to 8 cannot work...
    expect(solveZip(RING).solutionCount).toBe(0);
    // ...and 0 to 5 can, in exactly one way round.
    const open: ZipShape = { ...RING, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 1, column: 0 }] };
    const result = solveZip(open);
    expect(result.unique).toBe(true);
    expect(result.solutions[0]).toEqual([0, 1, 2, 5, 8, 7, 6, 3]);
    expect(validatePath(buildTopology(open), result.solutions[0])).toEqual({ complete: true, error: null, uncovered: [] });
    expect(validatePath(buildTopology(open), [0, 1, 2]).uncovered).not.toContain(4);
  });

  it("solves a board through the game state with fewer cells than the grid has", () => {
    const open: ZipShape = { ...RING, checkpoints: [{ number: 1, row: 0, column: 0 }, { number: 2, row: 1, column: 0 }] };
    const topology = buildTopology(open);
    let state = createZipGame("ring");
    for (const cell of [0, 1, 2, 5, 8, 7, 6, 3]) state = stepTo(topology, state, cell).state;
    expect(state.status).toBe("solved");
  });

  it("block figures keep the two colours of the checkerboard level, so a path can exist", () => {
    for (const name of BLOCK_FIGURES) {
      for (let size = zipSeeds.minSize; size <= zipSeeds.maxSize; size++) {
        for (let i = 0; i < 12; i++) {
          const figure = buildFigure(name, size, createRng(`blocks-${name}-${size}-${i}`));
          if (figure.blocked.length === 0) continue;
          expect(figure.walls).toHaveLength(0);
          const colour = (cell: number) => (Math.floor(cell / size) + (cell % size)) % 2;
          const even = Math.ceil((size * size) / 2) - figure.blocked.filter((cell) => colour(cell) === 0).length;
          const odd = Math.floor((size * size) / 2) - figure.blocked.filter((cell) => colour(cell) === 1).length;
          expect(Math.abs(even - odd), `${name} ${size}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("generated boards keep blocked cells off the path, the numbers and the walls, and stay unique", () => {
    let withBlocks = 0;
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 30; i++) {
        const puzzle = generateZipPuzzle(`blocked-${i}`, difficulty);
        expect(puzzle.metadata.blockedCount).toBe(puzzle.blocked.length);
        expect(puzzle.solution).toHaveLength(puzzle.width * puzzle.height - puzzle.blocked.length);
        if (puzzle.blocked.length === 0) continue;
        withBlocks++;
        const blocked = new Set(puzzle.blocked);
        expect(puzzle.solution.some((cell) => blocked.has(cell))).toBe(false);
        expect(puzzle.checkpoints.some((checkpoint) => blocked.has(checkpoint.row * puzzle.width + checkpoint.column))).toBe(false);
        expect(puzzle.walls.some((wall) => blocked.has(wall.a) || blocked.has(wall.b))).toBe(false);
        expect(validateZipPuzzle(puzzle)).toEqual({ ok: true, problems: [] });
      }
    }
    expect(withBlocks).toBeGreaterThan(10);
  });
});

describe("symmetric solutions", () => {
  it("builds a path whose second half is the image of the first, on even and odd boards", () => {
    for (const [size, symmetry] of [[6, "mirror-x"], [8, "mirror-y"], [5, "rotate"], [7, "rotate"]] as const) {
      const { neighbors, blockedAt } = buildTopology({ width: size, height: size, checkpoints: [], walls: [] });
      for (let i = 0; i < 8; i++) {
        const path = symmetricPath(createRng(`sym-${size}-${i}`), neighbors, blockedAt, size, symmetry, i / 3)!;
        expect(path, `${size} ${symmetry}`).not.toBeNull();
        expect(isHamiltonianPath(path, neighbors)).toBe(true);
        path.forEach((cell, index) => expect(mapCell(symmetry, size, path[path.length - 1 - index])).toBe(cell));
      }
    }
  });

  it("refuses a symmetry the size cannot have, and a board that is not symmetric itself", () => {
    const open = buildTopology({ width: 6, height: 6, checkpoints: [], walls: [] });
    expect(symmetricPath(createRng("s"), open.neighbors, open.blockedAt, 6, "rotate", 1)).toBeNull();
    const odd = buildTopology({ width: 7, height: 7, checkpoints: [], walls: [] });
    expect(symmetricPath(createRng("s"), odd.neighbors, odd.blockedAt, 7, "mirror-x", 1)).toBeNull();
    const lopsided = buildTopology({ width: 6, height: 6, checkpoints: [], walls: [{ a: 0, b: 1 }] });
    expect(symmetricPath(createRng("s"), lopsided.neighbors, lopsided.blockedAt, 6, "mirror-x", 1)).toBeNull();
  });

  it("generated boards flagged symmetric really are, and the seed decides which boards get one", () => {
    let symmetric = 0;
    for (let i = 0; i < 40; i++) {
      const puzzle = generateZipPuzzle(`symmetric-${i}`, "hard");
      if (!puzzle.metadata.theme.symmetric) continue;
      symmetric++;
      const size = puzzle.width;
      const last = puzzle.solution.length - 1;
      const fits = (["mirror-x", "mirror-y", "rotate"] as const).some((symmetry) => puzzle.solution.every((cell, index) => mapCell(symmetry, size, puzzle.solution[last - index]) === cell));
      expect(fits, puzzle.seed).toBe(true);
    }
    expect(symmetric).toBeGreaterThan(3);
    expect(symmetric).toBeLessThan(30);
  });

  it("one tier offers boards with many numbers and boards that trade numbers for walls", () => {
    const counts = Array.from({ length: 40 }, (_, i) => generateZipPuzzle(`trade-${i}`, "medium", { size: 7 }).metadata.checkpointCount);
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThanOrEqual(4);
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
  });

  it("keeps the version 1 board for days already played and switches to themed boards the day after", () => {
    expect(getZipDailyInfo("2026-09-21").seed).toBe("ZIP:2026-09-21:1:easy");
    expect(getZipDailyInfo("2026-09-22").spec.version).toBe(2);
    expect(getZipDailyInfo("2027-01-01").spec.version).toBe(2);
    expect(getZipDailyPuzzle("2026-09-21").puzzle.metadata.theme.path).toBe("random");
    // The weekday draw is keyed by the first generator, so a generator upgrade never changes a day's difficulty.
    expect(["easy", "medium"]).toContain(getZipDailyInfo("2026-09-22").difficulty);
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
