import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  SUMBREAK_TIERS,
  SumbreakSolver,
  applyMerge,
  buildBackwards,
  checkMerge,
  countTiles,
  generateSumbreakFromSpec,
  generateSumbreakPuzzle,
  getSumbreakDailyInfo,
  getSumbreakDailyPuzzle,
  isSolved,
  isStuck,
  legalMerges,
  mergeErrorText,
  replayMerges,
  sumbreakDailyDateFromSpec,
  sumbreakPuzzleId,
  sumbreakSeeds,
  validateSumbreakPuzzle,
} from "@/games/sumbreak/engine";
import { createRng, hashHex } from "@/shared/engine/prng";
import { translator } from "../i18n";

/**
 * 3x3 with one way through:
 *   1  1  .
 *   2  4  8
 *   . 32 16
 */
const CHAIN = [1, 1, 0, 2, 4, 8, 0, 32, 16];
const CHAIN_SOLUTION = [
  { from: 1, to: 0 },
  { from: 0, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 8 },
  { from: 8, to: 7 },
];
/** The first two boards LinkedIn published, as seen on the live game. They are test data for the solver, not shipped puzzles. */
const LINKEDIN_3 = [1, 1, 64, 4, 2, 32, 4, 4, 16];
const LINKEDIN_4 = [1, 1, 1, 512, 1, 4, 1, 256, 2, 8, 1, 128, 4, 8, 32, 64];

const BULK = Number(process.env.SUMBREAK_BULK ?? 60);

/** The English sentences, as a player with the interface in English reads them. */
const t = translator("sumbreak");
const pt = translator("sumbreak", "pt-br");

describe("rules", () => {
  it("merges equal side neighbours into the tile that was dropped on", () => {
    expect(checkMerge(3, CHAIN, { from: 1, to: 0 })).toBeNull();
    expect(applyMerge(CHAIN, { from: 1, to: 0 })).toEqual([2, 0, 0, 2, 4, 8, 0, 32, 16]);
    expect(applyMerge(CHAIN, { from: 0, to: 1 })).toEqual([0, 2, 0, 2, 4, 8, 0, 32, 16]);
  });

  it("refuses everything else and names the rule", () => {
    expect(checkMerge(3, CHAIN, { from: 0, to: 3 })).toEqual({ code: "different", values: { from: 1, to: 2 } });
    // Diagonal, far away, wrapping around a row end, and onto itself.
    expect(checkMerge(3, CHAIN, { from: 0, to: 4 })?.code).toBe("not-adjacent");
    expect(checkMerge(3, CHAIN, { from: 0, to: 8 })?.code).toBe("not-adjacent");
    expect(checkMerge(3, [2, 4, 8, 8, 1, 1, 0, 0, 0], { from: 2, to: 3 })?.code).toBe("not-adjacent");
    expect(checkMerge(3, CHAIN, { from: 0, to: 0 })?.code).toBe("not-adjacent");
    // Tiles do not move into empty cells, and an empty cell has nothing to move.
    expect(checkMerge(3, CHAIN, { from: 1, to: 2 })?.code).toBe("empty-target");
    expect(checkMerge(3, CHAIN, { from: 2, to: 1 })?.code).toBe("empty-source");
    expect(checkMerge(3, CHAIN, { from: -1, to: 0 })?.code).toBe("empty-source");
    expect(checkMerge(3, CHAIN, { from: 0, to: 9 })?.code).toBe("empty-source");
  });

  it("says why in the player's language", () => {
    const different = checkMerge(3, CHAIN, { from: 0, to: 3 })!;
    expect(mergeErrorText(t, different)).toBe("Numbers must be identical: 1 and 2 do not merge.");
    expect(mergeErrorText(pt, different)).toBe("Os números precisam ser iguais: 1 e 2 não se juntam.");
    // A number is written the way its tile shows it, without grouped digits.
    const large = checkMerge(3, [1024, 2048, 0, 0, 0, 0, 0, 0, 0], { from: 0, to: 1 })!;
    expect(mergeErrorText(t, large)).toBe("Numbers must be identical: 1024 and 2048 do not merge.");
    expect(mergeErrorText(pt, large)).toBe("Os números precisam ser iguais: 1024 e 2048 não se juntam.");

    expect(mergeErrorText(t, { code: "not-adjacent" })).toBe("Only neighbours merge: side by side, or one above the other.");
    expect(mergeErrorText(t, { code: "empty-target" })).toBe("Tiles do not move into empty cells. A tile only merges into an equal neighbour.");
    expect(mergeErrorText(t, { code: "empty-source" })).toBe("There is no tile to move there.");
    expect(mergeErrorText(pt, { code: "not-adjacent" })).toBe("Só peças vizinhas se juntam: lado a lado, ou uma em cima da outra.");
    expect(mergeErrorText(pt, { code: "empty-target" })).toBe("As peças não se movem para casas vazias. Uma peça só se junta a uma vizinha igual.");
    expect(mergeErrorText(pt, { code: "empty-source" })).toBe("Não há nenhuma peça ali para mover.");
  });

  it("lists legal merges in both directions and knows when a board is stuck or solved", () => {
    expect(legalMerges(3, CHAIN)).toEqual([{ from: 0, to: 1 }, { from: 1, to: 0 }]);
    expect(isStuck(3, CHAIN)).toBe(false);
    const wrongWay = applyMerge(CHAIN, { from: 0, to: 1 });
    expect(legalMerges(3, wrongWay)).toEqual([]);
    expect(isStuck(3, wrongWay)).toBe(true);
    const end = replayMerges(3, CHAIN, CHAIN_SOLUTION)!;
    expect(end).toEqual([0, 0, 0, 0, 0, 0, 0, 64, 0]);
    expect([isSolved(end), isStuck(3, end), countTiles(end)]).toEqual([true, false, 1]);
    expect(replayMerges(3, CHAIN, [{ from: 0, to: 3 }])).toBeNull();
  });
});

describe("solver", () => {
  it("solves a board and its solution replays through the rules", () => {
    const solution = new SumbreakSolver(3).solve(CHAIN)!;
    expect(solution).toHaveLength(6);
    expect(countTiles(replayMerges(3, CHAIN, solution)!)).toBe(1);
    for (const [size, cells] of [[3, LINKEDIN_3], [4, LINKEDIN_4]] as const) {
      const line = new SumbreakSolver(size).solve(cells)!;
      expect(line).toHaveLength(size * size - 1);
      expect(replayMerges(size, cells, line)!.filter((value) => value !== 0)).toEqual([cells.reduce((sum, value) => sum + value, 0)]);
    }
  });

  it("recognizes dead boards and says why when it is plain to see", () => {
    const solver = new SumbreakSolver(3);
    expect(solver.quickDeadReason(CHAIN)).toBeNull();
    // Three 1s cannot pair up.
    expect(solver.quickDeadReason([1, 1, 1, 0, 0, 0, 0, 0, 0])).toBe("odd-count");
    // Two groups that can never meet.
    expect(solver.quickDeadReason([1, 1, 0, 0, 0, 0, 0, 2, 0])).toBe("split");
    expect(solver.quickDeadReason([1, 1, 0, 0, 0, 0, 0, 1, 1])).toBe("split");
    // A 2 with no 2 beside it.
    expect(solver.quickDeadReason(applyMerge(CHAIN, { from: 0, to: 1 }))).toBe("lonely");
    expect(solver.isSolvable(applyMerge(CHAIN, { from: 0, to: 1 }))).toBe(false);
    // Dead without an obvious reason: the 1s pair up fine, but the 2 they make can never reach the other 2.
    const subtle = [1, 1, 4, 0, 0, 4, 0, 0, 2];
    expect(solver.quickDeadReason(subtle)).toBeNull();
    expect(solver.isSolvable(subtle)).toBe(false);
    expect(solver.isSolvable([1, 1, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(solver.isSolvable([64, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
  });

  it("only needs merges of the smallest number: the answer matches a search over every merge", () => {
    // Brute force over all legal merges, no ordering trick, as an oracle.
    const brute = (size: number, cells: readonly number[], seen = new Map<string, boolean>()): boolean => {
      if (countTiles(cells) === 1) return true;
      const key = cells.join(",");
      const known = seen.get(key);
      if (known !== undefined) return known;
      const result = legalMerges(size, cells).some((merge) => brute(size, applyMerge(cells, merge), seen));
      seen.set(key, result);
      return result;
    };
    const rng = createRng("oracle");
    let dead = 0;
    for (let round = 0; round < 150; round++) {
      // Random 3x3 boards of small powers of two: most cannot be finished, some can.
      const cells = Array.from({ length: 9 }, () => (rng.chance(0.15) ? 0 : 2 ** rng.int(3)));
      if (countTiles(cells) < 2) continue;
      const expected = brute(3, cells);
      if (!expected) dead++;
      expect(new SumbreakSolver(3).isSolvable(cells), cells.join(",")).toBe(expected);
    }
    expect(dead).toBeGreaterThan(20);
    for (let round = 0; round < 40; round++) {
      const built = buildBackwards(createRng(`oracle-${round}`), 3, 6, 0.5);
      if (built) expect(brute(3, built.cells)).toBe(true);
    }
  });

  it("measures how easy it is to go wrong, and ranks LinkedIn's boards the way they were published", () => {
    const first = new SumbreakSolver(3).winChance(LINKEDIN_3);
    const sunday = new SumbreakSolver(4).winChance(LINKEDIN_4);
    expect(first).toBeCloseTo(0.5, 5);
    expect(sunday).toBeGreaterThan(0.02);
    expect(sunday).toBeLessThan(0.1);
    expect(new SumbreakSolver(3).winChance(CHAIN)).toBe(1);
    expect(new SumbreakSolver(3).options(CHAIN)).toEqual({ total: 2, alive: 1 });
    expect(new SumbreakSolver(3).winChance(applyMerge(CHAIN, { from: 0, to: 1 }))).toBe(0);
  });

  it("works on a node budget and gives the same answer every time", () => {
    const run = () => {
      const solver = new SumbreakSolver(4);
      return `${solver.winChance(LINKEDIN_4)} ${solver.nodes}`;
    };
    expect(run()).toBe(run());
    expect(() => new SumbreakSolver(4, 3).winChance(LINKEDIN_4)).toThrow(/budget/);
  });
});

describe("generator", () => {
  it("is a pure function of the seed", () => {
    const first = generateSumbreakPuzzle("determinism", "hard");
    expect(generateSumbreakPuzzle("determinism", "hard")).toEqual(first);
    expect(generateSumbreakPuzzle("determinism-2", "hard").cells).not.toEqual(first.cells);
    expect(generateSumbreakPuzzle("determinism", "expert").id).not.toBe(first.id);
  });

  // Any change to the PRNG stream, the builder or the solver shows up here. If it is deliberate, bump SUMBREAK_GENERATOR_VERSION.
  it("pins one known puzzle", () => {
    const puzzle = generateSumbreakPuzzle("example-seed", "medium");
    expect(puzzle.seed).toBe("SUMBREAK:example-seed:1:medium");
    expect(puzzle.id).toBe(sumbreakPuzzleId(puzzle.seed));
    expect(hashHex(`${puzzle.size}|${puzzle.cells.join(",")}`)).toMatchInlineSnapshot(`"1de1bc2e5e7333f561c29fb6d0d9e6e0"`);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`builds full, solvable ${difficulty} boards near the tier's target`, () => {
      const tier = SUMBREAK_TIERS[difficulty];
      let near = 0;
      for (let index = 0; index < BULK; index++) {
        const puzzle = generateSumbreakPuzzle(`bulk-${index}`, difficulty);
        expect(validateSumbreakPuzzle(puzzle).problems, puzzle.seed).toEqual([]);
        expect(tier.sizes).toContain(puzzle.size);
        expect(countTiles(puzzle.cells)).toBe(puzzle.size * puzzle.size);
        expect(puzzle.solution).toHaveLength(puzzle.size * puzzle.size - 1);
        // Every tile is a power of two, and they add up to the last tile, which is one too.
        for (const value of [...puzzle.cells, puzzle.total]) expect(Number.isInteger(Math.log2(value))).toBe(true);
        expect(puzzle.cells.reduce((sum, value) => sum + value, 0)).toBe(puzzle.total);
        if (Math.abs(Math.log(puzzle.metadata.winChance) - Math.log(tier.winChance)) <= tier.tolerance) near++;
      }
      expect(near).toBeGreaterThanOrEqual(Math.floor(BULK * 0.85));
    });
  }

  it("makes harder tiers harder by the measure", () => {
    const mean = (difficulty: (typeof DIFFICULTIES)[number]) => {
      let total = 0;
      for (let index = 0; index < BULK; index++) total += Math.log(generateSumbreakPuzzle(`bulk-${index}`, difficulty).metadata.winChance);
      return total / BULK;
    };
    const [easy, medium, hard, expert] = DIFFICULTIES.map(mean);
    expect(easy).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(hard);
    expect(hard).toBeGreaterThan(expert);
  });

  it("honours a requested size, and rejects sizes and versions it does not have", () => {
    for (const size of [3, 4, 5]) {
      const puzzle = generateSumbreakPuzzle("sized", "medium", { size });
      expect(puzzle.size).toBe(size);
      expect(puzzle.seed).toBe(`SUMBREAK:sized:1:medium:${size}`);
      expect(validateSumbreakPuzzle(puzzle).ok).toBe(true);
    }
    expect(() => generateSumbreakFromSpec({ token: "x", version: 1, difficulty: "easy", size: 6 })).toThrow(/size 6/);
    expect(() => generateSumbreakFromSpec({ token: "x", version: 9, difficulty: "easy" })).toThrow(/version 9/);
    expect(sumbreakSeeds.parse("QUEENS:x:1:easy")).toBeNull();
  });

  it("catches a broken puzzle in the validator", () => {
    const puzzle = generateSumbreakPuzzle("validator", "easy");
    expect(validateSumbreakPuzzle({ ...puzzle, solution: puzzle.solution.slice(1) }).ok).toBe(false);
    expect(validateSumbreakPuzzle({ ...puzzle, total: puzzle.total + 1 }).ok).toBe(false);
    expect(validateSumbreakPuzzle({ size: 3, cells: [1, 1, 1, 0, 0, 0, 0, 0, 0], solution: [] }).problems).toContain("The solver cannot finish the board.");
  });
});

describe("daily", () => {
  it("numbers puzzles from LinkedIn's launch day and follows the weekly schedule", () => {
    expect(getSumbreakDailyInfo("2026-11-18").number).toBe(1);
    expect(getSumbreakDailyInfo("2026-11-23").number).toBe(6);
    // 2026-11-23 is a Monday, the easy day. Sunday the 22nd is expert.
    expect(getSumbreakDailyInfo("2026-11-23").seed).toBe("SUMBREAK:2026-11-23:1:easy");
    expect(getSumbreakDailyInfo("2026-11-22").difficulty).toBe("expert");
  });

  it("builds the same puzzle for a date however it is asked", () => {
    const byDate = getSumbreakDailyPuzzle("2026-11-24");
    // 07:30 UTC on the 25th is still 23:30 on the 24th in Pacific time.
    expect(getSumbreakDailyPuzzle(new Date("2026-11-25T07:30:00Z")).puzzle).toEqual(byDate.puzzle);
    expect(sumbreakDailyDateFromSpec(byDate.info.spec)).toBe("2026-11-24");
    expect(sumbreakDailyDateFromSpec({ ...byDate.info.spec, size: 4 })).toBeNull();
  });
});
