import { describe, expect, it } from "vitest";
import {
  WEND_DAILY_CONFIG,
  WEND_MAX_SIZE,
  WEND_MAX_WORD,
  WEND_MIN_SIZE,
  WEND_THEMES,
  WEND_TIERS,
  type WendShape,
  cellSetKey,
  countBends,
  findPlacements,
  generateWendFromSpec,
  generateWendPuzzle,
  getWendDailyInfo,
  getWendDailyPuzzle,
  isPath,
  neighboursOf,
  plainLetters,
  solveWend,
  validateWendPuzzle,
  wendDailyDateFromSpec,
  wendPuzzleId,
  wendSeeds,
  wendThemes,
} from "@/games/wend/engine";
import { WEND_TUTORIAL_PUZZLE } from "@/games/wend/components/tutorial/tutorial-puzzle";
import { DIFFICULTIES } from "@/shared/engine/difficulty";
import { addDays } from "@/shared/engine/pacific-time";

/**
 * LinkedIn Wend #167 (2026-11-22), read from the live game. Used only as test
 * data for the solver: six words of 5 to 10 letters on a 7x7 with four walls.
 */
const LINKEDIN_167: { size: number; letters: string[]; words: string[] } = {
  size: 7,
  letters: ["TO#D#EH", "#PWOTA#", "LPNANVD", "EEHDNYE", "NCILECS", "ALALNDI", "IMBLAGN"].flatMap((row) => [...row].map((letter) => (letter === "#" ? "" : letter))),
  words: ["HEAVY", "TOPPLE", "LANDING", "DOWNHILL", "IMBALANCE", "DESCENDANT"],
};

describe("word bank", () => {
  it("holds single words of 3 to 12 plain letters, each once per theme", () => {
    for (const theme of WEND_THEMES) {
      const seen = new Set<string>();
      for (const word of theme.words.split(" ")) {
        const plain = plainLetters(word);
        expect(plain, `${theme.title}: ${word}`).toMatch(/^[A-Z]{3,12}$/);
        expect(seen.has(plain), `${theme.title}: ${word} twice`).toBe(false);
        seen.add(plain);
      }
    }
  });

  it("has unique theme titles, and every theme can fill every tier's own board", () => {
    expect(new Set(WEND_THEMES.map((theme) => theme.title)).size).toBe(WEND_THEMES.length);
    for (const theme of wendThemes()) {
      const lengths = [...theme.byLength.keys()];
      // Enough different lengths for the smallest recipe: an easy board needs four of them between 3 and 7.
      expect(lengths.filter((length) => length >= 3 && length <= 7).length, theme.title).toBeGreaterThanOrEqual(4);
    }
  });

  it("strips accents for the board and keeps them for display", () => {
    expect(plainLetters("maçã")).toBe("MACA");
    expect(plainLetters("Ônibus")).toBe("ONIBUS");
    const fruit = wendThemes().find((theme) => theme.title === "Frutas");
    expect(fruit?.byLength.get(4)).toContainEqual({ text: "MACA", display: "MAÇÃ" });
  });
});

describe("grid", () => {
  it("lists orthogonal neighbours only", () => {
    expect(neighboursOf(3)[4]).toEqual([1, 3, 5, 7]);
    expect(neighboursOf(3)[0]).toEqual([1, 3]);
    // The end of a row does not touch the start of the next one.
    expect(neighboursOf(3)[2]).toEqual([1, 5]);
  });

  it("recognises paths, cell sets and corners", () => {
    expect(isPath(3, [0, 1, 2, 5])).toBe(true);
    expect(isPath(3, [0, 4])).toBe(false);
    expect(isPath(3, [2, 3])).toBe(false);
    expect(isPath(3, [0, 1, 0])).toBe(false);
    expect(cellSetKey([5, 1, 3])).toBe(cellSetKey([3, 5, 1]));
    expect(countBends([0, 1, 2])).toBe(0);
    expect(countBends([0, 1, 4, 5])).toBe(2);
  });
});

describe("solver", () => {
  it("finds the one way the words of a real Wend board fit", () => {
    const solved = solveWend(LINKEDIN_167.size, LINKEDIN_167.letters, LINKEDIN_167.words);
    expect(solved.count).toBe(1);
    // HEAVY as the hints of the live game revealed it: H, E, A, V, Y.
    expect(solved.first?.[0]).toEqual([6, 5, 12, 19, 26]);
    expect(solved.first?.[1]).toEqual([0, 1, 8, 15, 14, 21]);
    const covered = new Set(solved.first?.flat());
    expect(covered.size).toBe(45);
  });

  it("finds every trace of a word, once per set of cells", () => {
    // BLAND is on the real board too, but it is not one of the hidden words.
    const bland = findPlacements(LINKEDIN_167.size, LINKEDIN_167.letters, "BLAND", { nodes: 10_000 });
    expect(bland.map((placement) => placement.path)).toContainEqual([44, 45, 46, 39, 40]);
    // A square of A and N: ANA runs through three of its four cells in several orders, but each cell set counts once.
    const square = findPlacements(2, ["A", "N", "N", "A"], "ANA", { nodes: 1_000 });
    expect(square).toHaveLength(2);
  });

  it("counts two solutions when the words fit in two ways", () => {
    //  A B      AB and CD fit in one way.
    //  C D
    expect(solveWend(2, ["A", "B", "C", "D"], ["AB", "CD"]).count).toBe(1);
    //  A B      AB and BA: each row reads either way, so they can swap rows.
    //  A B
    expect(solveWend(2, ["A", "B", "A", "B"], ["AB", "BA"]).count).toBe(2);
    //  A B      ABA + B: the lone B can be either B.
    //  B A
    expect(solveWend(2, ["A", "B", "B", "A"], ["ABA", "B"]).count).toBe(2);
    expect(solveWend(2, ["A", "B", "B", "A"], ["ABC", "B"]).count).toBe(0);
  });

  it("stops at its node budget", () => {
    expect(() => solveWend(LINKEDIN_167.size, LINKEDIN_167.letters, LINKEDIN_167.words, 2, 5)).toThrow("budget");
  });
});

describe("generator", () => {
  it("builds valid boards with one solution in every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < 25; index++) {
        const puzzle = generateWendPuzzle(`unit-${index}`, difficulty);
        const check = validateWendPuzzle(puzzle);
        expect(check.problems, puzzle.seed).toEqual([]);
        const tier = WEND_TIERS[difficulty];
        expect(tier.sizes).toContain(puzzle.size);
        expect(puzzle.words.length).toBeGreaterThanOrEqual(tier.words[0]);
        expect(puzzle.words.length).toBeLessThanOrEqual(tier.words[1]);
        for (const word of puzzle.words) {
          expect(word.text.length).toBeGreaterThanOrEqual(tier.lengths[0]);
          expect(word.text.length).toBeLessThanOrEqual(tier.lengths[1]);
        }
        expect(puzzle.metadata.walls).toBeGreaterThanOrEqual(tier.walls[0]);
        expect(puzzle.metadata.walls).toBeLessThanOrEqual(tier.walls[1]);
        expect(puzzle.themeShown).toBe(tier.themeShown);
      }
    }
  });

  it("takes all its words from one theme, with their accents", () => {
    const puzzle = generateWendPuzzle("theme-check", "hard");
    const theme = WEND_THEMES.find((entry) => entry.title === puzzle.theme);
    const bank = new Set(theme?.words.split(" ").map((word) => word.toUpperCase()));
    for (const word of puzzle.words) {
      expect(bank.has(word.display), word.display).toBe(true);
      expect(plainLetters(word.display)).toBe(word.text);
    }
  });

  it("is deterministic: the same seed builds the same puzzle", () => {
    const first = generateWendPuzzle("example-seed", "medium");
    const second = generateWendPuzzle("example-seed", "medium");
    expect(second).toEqual(first);
    expect(first.id).toBe(wendPuzzleId(first.seed));
    expect(generateWendPuzzle("example-seed", "hard").letters).not.toEqual(first.letters);
    expect(generateWendPuzzle("another-seed", "medium").letters).not.toEqual(first.letters);
  });

  it("honours a board size picked by hand, in every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let size = WEND_MIN_SIZE; size <= WEND_MAX_SIZE; size++) {
        const puzzle = generateWendPuzzle("sized", difficulty, { size });
        expect(puzzle.size).toBe(size);
        expect(validateWendPuzzle(puzzle).ok, puzzle.seed).toBe(true);
        expect(Math.max(...puzzle.words.map((word) => word.text.length))).toBeLessThanOrEqual(WEND_MAX_WORD);
      }
    }
  });

  it("refuses sizes and versions it does not have", () => {
    expect(() => generateWendFromSpec({ token: "x", version: 1, difficulty: "easy", size: 4 })).toThrow(RangeError);
    expect(() => generateWendFromSpec({ token: "x", version: 9, difficulty: "easy" })).toThrow(RangeError);
  });

  it("validator catches a broken puzzle", () => {
    const puzzle = generateWendPuzzle("to-break", "easy");
    const first = puzzle.words[0];
    const swapped: WendShape = { ...puzzle, words: [{ ...first, path: [...first.path].reverse() }, ...puzzle.words.slice(1)] };
    expect(validateWendPuzzle(swapped).ok).toBe(false);
    const letters = [...puzzle.letters];
    letters[first.path[0]] = first.text[0] === "Q" ? "Z" : "Q";
    expect(validateWendPuzzle({ ...puzzle, letters }).ok).toBe(false);
    expect(validateWendPuzzle(WEND_TUTORIAL_PUZZLE).problems).toEqual([]);
  });
});

describe("daily", () => {
  it("numbers the days from LinkedIn's launch date", () => {
    expect(getWendDailyInfo(WEND_DAILY_CONFIG.epoch).number).toBe(1);
    // LinkedIn showed Wend #167 on 2026-11-22.
    expect(getWendDailyInfo("2026-11-22").number).toBe(167);
    expect(getWendDailyInfo("2026-11-22").difficulty).toBe("expert");
    expect(getWendDailyInfo("2026-11-23").seed).toBe("WEND:2026-11-23:1:easy");
  });

  it("recognises a daily seed and rejects a forged one", () => {
    const info = getWendDailyInfo("2026-11-25");
    expect(wendDailyDateFromSpec(info.spec)).toBe("2026-11-25");
    expect(wendDailyDateFromSpec({ ...info.spec, difficulty: "expert" })).toBeNull();
    expect(wendDailyDateFromSpec({ ...info.spec, size: 6 })).toBeNull();
    expect(wendSeeds.parse(info.seed)).toEqual(info.spec);
  });

  it("builds the daily puzzle and does not repeat a theme for weeks", () => {
    const { info, puzzle } = getWendDailyPuzzle("2026-11-23");
    expect(puzzle.seed).toBe(info.seed);
    expect(validateWendPuzzle(puzzle).ok).toBe(true);
    const themes: string[] = [];
    for (let day = 0; day < 28; day++) themes.push(getWendDailyPuzzle(addDays("2026-11-23", day)).puzzle.theme);
    // The deck of themes is walked one card a day. A repeat only happens when a theme cannot fill that day's board and another steps in.
    expect(new Set(themes).size).toBeGreaterThanOrEqual(27);
  });
});
