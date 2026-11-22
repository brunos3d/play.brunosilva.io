import { describe, expect, it } from "vitest";
import { CHESS_TIERS, type ChessPuzzle, DIFFICULTIES, type Difficulty, Position, chessDailyDateFromSpec, chessPuzzleId, chessSeeds, generateChessFromSpec, generateChessPuzzle, getChessDailyInfo, getChessDailyPuzzle, isCheckmate, positionAfter, resolvePuzzle, validateChessPuzzle } from "@/games/chess/engine";
import { hashHex } from "@/shared/engine/prng";

const BULK = Number(process.env.CHESS_BULK ?? 12);

// The bulk puzzles are shared by several tests, so each one is built once.
const built = new Map<string, ChessPuzzle>();
function bulkPuzzle(index: number, difficulty: Difficulty): ChessPuzzle {
  const key = `${difficulty}-${index}`;
  let puzzle = built.get(key);
  if (!puzzle) built.set(key, (puzzle = generateChessPuzzle(`bulk-${index}`, difficulty)));
  return puzzle;
}

describe("generator", () => {
  it("is a pure function of the seed", () => {
    const first = generateChessPuzzle("determinism", "hard");
    const second = generateChessPuzzle("determinism", "hard");
    expect(second).toEqual(first);
    expect(generateChessPuzzle("determinism-2", "hard").fen).not.toBe(first.fen);
    expect(generateChessPuzzle("determinism", "easy").id).not.toBe(first.id);
  });

  // Any change to the PRNG stream, the search or the mining shows up here. If it is deliberate, bump CHESS_GENERATOR_VERSION.
  it("pins one known puzzle", () => {
    const puzzle = generateChessPuzzle("example-seed", "medium");
    expect(puzzle.seed).toBe("CHESS:example-seed:1:medium");
    expect(puzzle.id).toBe(chessPuzzleId(puzzle.seed));
    expect(hashHex([puzzle.fen, puzzle.setup, puzzle.line.join(" "), puzzle.kind, puzzle.themes.join(",")].join("|"))).toMatchInlineSnapshot(`"a9ac6b2bb118ff541d9c0889de64ecd1"`);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`builds valid ${difficulty} puzzles from the tier's own recipes`, () => {
      const names = new Set(CHESS_TIERS[difficulty].recipes.map((recipe) => recipe.name));
      let fromTier = 0;
      const seen = new Set<string>();
      for (let index = 0; index < BULK; index++) {
        const puzzle = bulkPuzzle(index, difficulty);
        const check = validateChessPuzzle(puzzle);
        expect(check.errors, puzzle.seed).toEqual([]);
        if (names.has(puzzle.metadata.recipe)) fromTier++;
        seen.add(puzzle.fen);

        const resolved = resolvePuzzle(puzzle);
        // The start is a legal position with both kings, reached by play, and the solver has a real choice.
        const start = Position.fromFen(puzzle.fen);
        expect(start.inCheck() && !start.hasLegalMove()).toBe(false);
        expect(positionAfter(resolved, []).legalMoves().length).toBeGreaterThanOrEqual(3);
        expect(puzzle.metadata.pieces).toBeGreaterThanOrEqual(10);
        if (puzzle.kind === "mate") expect(isCheckmate(positionAfter(resolved, resolved.line))).toBe(true);
        expect(puzzle.line.length).toBe(puzzle.kind === "mate" ? puzzle.mateIn * 2 - 1 : puzzle.line.length);
      }
      expect(seen.size).toBe(BULK);
      // Fallback recipes exist for the rare seed. They must stay rare.
      expect(fromTier).toBeGreaterThanOrEqual(Math.floor(BULK * 0.9));
    });
  }

  it("gives harder tiers longer solutions", () => {
    const solverMoves = (difficulty: (typeof DIFFICULTIES)[number]) => {
      let total = 0;
      for (let index = 0; index < BULK; index++) total += (bulkPuzzle(index, difficulty).line.length + 1) / 2;
      return total / BULK;
    };
    const easy = solverMoves("easy");
    const medium = solverMoves("medium");
    const expert = solverMoves("expert");
    expect(easy).toBe(1);
    expect(medium).toBeGreaterThan(easy);
    expect(expert).toBeGreaterThan(medium);
  });

  it("rejects versions and sizes it does not have", () => {
    expect(() => generateChessFromSpec({ token: "x", version: 99, difficulty: "easy" })).toThrow(/version 99/);
    expect(() => generateChessFromSpec({ token: "x", version: 1, difficulty: "easy", size: 6 })).toThrow(/size 6/);
    expect(chessSeeds.parse("ZIP:x:1:easy")).toBeNull();
  });
});

describe("daily", () => {
  it("numbers puzzles from the launch date and follows the weekly schedule", () => {
    expect(getChessDailyInfo("2026-11-22").number).toBe(1);
    expect(getChessDailyInfo("2026-11-23").number).toBe(2);
    // 2026-11-22 is a Sunday, the expert day. Monday is easy.
    expect(getChessDailyInfo("2026-11-22").difficulty).toBe("expert");
    expect(getChessDailyInfo("2026-11-23").difficulty).toBe("easy");
    expect(getChessDailyInfo("2026-11-23").seed).toBe("CHESS:2026-11-23:1:easy");
  });

  it("builds the same puzzle for a date however it is asked", () => {
    const byDate = getChessDailyPuzzle("2026-11-24");
    // 07:30 UTC on the 25th is still 23:30 on the 24th in Pacific time.
    const byInstant = getChessDailyPuzzle(new Date("2026-11-25T07:30:00Z"));
    expect(byInstant.puzzle).toEqual(byDate.puzzle);
    expect(validateChessPuzzle(byDate.puzzle).ok).toBe(true);
    expect(chessDailyDateFromSpec(byDate.info.spec)).toBe("2026-11-24");
    expect(chessDailyDateFromSpec({ ...byDate.info.spec, difficulty: "expert" })).toBeNull();
  });
});
