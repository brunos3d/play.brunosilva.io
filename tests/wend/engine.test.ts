import { describe, expect, it } from "vitest";
import {
  WEND_BANKS,
  WEND_DAILY_CONFIG,
  WEND_MAX_SIZE,
  WEND_MAX_WORD,
  WEND_MIN_SIZE,
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
  wendLanguage,
  wendPuzzleId,
  wendSeeds,
  wendThemes,
} from "@/games/wend/engine";
import { WEND_TUTORIALS, WEND_TUTORIAL_PUZZLE } from "@/games/wend/components/tutorial/tutorial-puzzle";
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

// The rules every word bank follows are in bank.test.ts, for both languages.
describe("letters", () => {
  it("strips accents for the board and keeps them for display", () => {
    expect(plainLetters("maçã")).toBe("MACA");
    expect(plainLetters("Ônibus")).toBe("ONIBUS");
    const fruit = wendThemes("pt-br").find((theme) => theme.title === "Frutas");
    expect(fruit?.byLength.get(4)).toContainEqual({ text: "MACA", display: "MAÇÃ" });
  });

  it("reads English words through the same functions, with nothing to strip", () => {
    expect(plainLetters("pear")).toBe("PEAR");
    const fruit = wendThemes("en").find((theme) => theme.title === "Fruits");
    expect(fruit?.byLength.get(4)).toContainEqual({ text: "PEAR", display: "PEAR" });
    for (const theme of wendThemes("en")) for (const words of theme.byLength.values()) for (const word of words) expect(word.display).toBe(word.text);
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
    const theme = WEND_BANKS["pt-br"].find((entry) => entry.title === puzzle.theme);
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

  it("still builds, letter for letter, the Portuguese boards it built before the game had two languages", () => {
    const board = (seed: string) => {
      const puzzle = generateWendFromSpec(wendSeeds.parse(seed)!);
      return { id: puzzle.id, theme: puzzle.theme, letters: puzzle.letters.map((letter) => letter || "#").join(""), words: puzzle.words.map((word) => word.display) };
    };
    expect(board("WEND:e2e-wend-1:1:easy")).toEqual({ id: "wend-3ba3266f135a", theme: "No banheiro", letters: "OLAMINOLMNIC#OAAVOT##ASAB", words: ["VASO", "BATOM", "LÂMINA", "COLÔNIA"] });
    expect(board("WEND:example-seed:1:medium")).toEqual({ id: "wend-5aa89a2eb1f6", theme: "Instrumentos musicais", letters: "NETEOAIRALCLAS#VIONFONAOPETEAGMORTGO", words: ["AGOGÔ", "VIOLÃO", "SANFONA", "TROMPETE", "CLARINETE"] });
    expect(board("WEND:theme-check:1:hard")).toEqual({
      id: "wend-2691597e8cf6",
      theme: "Na horta",
      letters: "ORACSABLECAERAAB#LCRA#OLCAESASAH#TLAP#OBEARGOFRAS",
      words: ["SALSA", "CEBOLA", "ASPARGO", "ESCAROLA", "BETERRABA", "ALCACHOFRA"],
    });
    expect(board("WEND:sized-0:1:expert:8")).toEqual({
      id: "wend-47114a899b93",
      theme: "Cinema e teatro",
      letters: "ATSGEEGAAGIAMMUITONNTNQAORSOEA#MREAR#R#FPPTIOUGIE#NEMUCOSNEPSUSD",
      words: ["SUSPENSE", "FIGURANTE", "MAQUIAGEM", "PERSONAGEM", "DOCUMENTÁRIO", "PROTAGONISTA"],
    });
    // A seed that names Portuguese is the same seed.
    expect(generateWendFromSpec(wendSeeds.resolve({ seed: "example-seed", difficulty: "medium", lang: "pt-br" }))).toEqual(generateWendPuzzle("example-seed", "medium"));
    expect(generateWendPuzzle("example-seed", "medium").language).toBe("pt-br");
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

describe("English puzzles", () => {
  it("builds valid boards from the English bank in every tier", () => {
    const bank = new Map(WEND_BANKS.en.map((theme) => [theme.title, new Set(theme.words.split(" ").map((word) => word.toUpperCase()))]));
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < 25; index++) {
        const puzzle = generateWendPuzzle(`unit-${index}`, difficulty, { language: "en" });
        expect(validateWendPuzzle(puzzle).problems, puzzle.seed).toEqual([]);
        expect(puzzle.language).toBe("en");
        const tier = WEND_TIERS[difficulty];
        expect(tier.sizes).toContain(puzzle.size);
        expect(puzzle.words.length).toBeGreaterThanOrEqual(tier.words[0]);
        expect(puzzle.words.length).toBeLessThanOrEqual(tier.words[1]);
        expect(puzzle.metadata.walls).toBeGreaterThanOrEqual(tier.walls[0]);
        expect(puzzle.metadata.walls).toBeLessThanOrEqual(tier.walls[1]);
        // One theme of the English bank, and only words of that theme.
        const words = bank.get(puzzle.theme);
        expect(words, `${puzzle.seed}: ${puzzle.theme}`).toBeDefined();
        for (const word of puzzle.words) {
          expect(words?.has(word.display), `${puzzle.seed}: ${word.display}`).toBe(true);
          expect(word.text.length).toBeGreaterThanOrEqual(tier.lengths[0]);
          expect(word.text.length).toBeLessThanOrEqual(tier.lengths[1]);
        }
      }
    }
  });

  it("carries the language in the seed, the id and the puzzle", () => {
    const english = generateWendPuzzle("lucky", "hard", { size: 7, language: "en" });
    const portuguese = generateWendPuzzle("lucky", "hard", { size: 7 });
    expect(english.seed).toBe("WEND:lucky:1:hard:7:en");
    expect(portuguese.seed).toBe("WEND:lucky:1:hard:7");
    expect(english.language).toBe("en");
    expect(wendLanguage(wendSeeds.parse(english.seed)!)).toBe("en");
    expect(wendLanguage(wendSeeds.parse(portuguese.seed)!)).toBe("pt-br");
    // Two languages are two puzzles: another id, so saved boards and results never mix.
    expect(english.id).not.toBe(portuguese.id);
    expect(english.id).toBe(wendPuzzleId(english.seed));
    expect(english.letters).not.toEqual(portuguese.letters);
    expect(WEND_BANKS.en.some((theme) => theme.title === english.theme)).toBe(true);
    expect(WEND_BANKS["pt-br"].some((theme) => theme.title === portuguese.theme)).toBe(true);
  });

  it("is deterministic: an English seed builds the same puzzle every time, from the seed alone", () => {
    const first = generateWendPuzzle("example-seed", "medium", { language: "en" });
    expect(generateWendPuzzle("example-seed", "medium", { language: "en" })).toEqual(first);
    // The canonical seed is all a shared link carries.
    expect(generateWendFromSpec(wendSeeds.parse(first.seed)!)).toEqual(first);
    expect(generateWendFromSpec(wendSeeds.resolve({ seed: "example-seed", difficulty: "medium", lang: "en" }))).toEqual(first);
    expect(generateWendPuzzle("another-seed", "medium", { language: "en" }).letters).not.toEqual(first.letters);
    expect(generateWendPuzzle("example-seed", "hard", { language: "en" }).letters).not.toEqual(first.letters);
  });

  it("honours a board size picked by hand, in every tier", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let size = WEND_MIN_SIZE; size <= WEND_MAX_SIZE; size++) {
        const puzzle = generateWendPuzzle("sized", difficulty, { size, language: "en" });
        expect(puzzle.size).toBe(size);
        expect(validateWendPuzzle(puzzle).ok, puzzle.seed).toBe(true);
      }
    }
  });

  it("has a tutorial board of its own, with the shape of the Portuguese one and a single solution", () => {
    const [portuguese, english] = [WEND_TUTORIALS["pt-br"].puzzle, WEND_TUTORIALS.en.puzzle];
    expect(portuguese).toBe(WEND_TUTORIAL_PUZZLE);
    expect(english.words.map((word) => word.display)).toEqual(["FIG", "PEAR"]);
    expect(portuguese.words.map((word) => word.display)).toEqual(["UVA", "FIGO"]);
    for (const puzzle of [portuguese, english]) {
      expect(validateWendPuzzle(puzzle).problems, puzzle.id).toEqual([]);
      expect(solveWend(puzzle.size, puzzle.letters, puzzle.words.map((word) => word.text)).count).toBe(1);
      expect(puzzle.words.map((word) => word.text.length)).toEqual([3, 4]);
    }
    // Same walls, same paths: the steps of the tutorial describe both boards.
    expect(english.letters.map((letter) => letter === "")).toEqual(portuguese.letters.map((letter) => letter === ""));
    expect(english.words.map((word) => word.path)).toEqual(portuguese.words.map((word) => word.path));
    expect(english.id).not.toBe(portuguese.id);
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

  it("keeps the Portuguese daily themes it always had", () => {
    const themes = Array.from({ length: 10 }, (_, day) => getWendDailyPuzzle(addDays("2026-11-20", day)).puzzle.theme);
    expect(themes).toEqual(["Ferramentas", "Tecnologia", "Bebidas", "Na cidade", "Calendário", "Saúde", "Animais selvagens", "Na cozinha", "No céu", "No banheiro"]);
    const sunday = getWendDailyPuzzle("2026-11-22").puzzle;
    expect(sunday.id).toBe("wend-8227f7b5273b");
    expect(sunday.words.map((word) => word.display)).toEqual(["BATIDA", "GARAPA", "GUARANÁ", "TEQUILA", "LIMONADA", "VITAMINA", "CHAMPANHE", "ENERGÉTICO"]);
  });

  it("has one daily puzzle per language: the same day, number and tier, with other words", () => {
    const portuguese = getWendDailyInfo("2026-11-22");
    const english = getWendDailyInfo("2026-11-22", "en");
    expect(english.seed).toBe("WEND:2026-11-22:1:expert:en");
    expect(english.variant).toBe("en");
    expect(portuguese.variant).toBeUndefined();
    expect(getWendDailyInfo("2026-11-22", "pt-br")).toEqual(portuguese);
    expect({ number: english.number, difficulty: english.difficulty, date: english.date }).toEqual({ number: portuguese.number, difficulty: portuguese.difficulty, date: portuguese.date });
    expect(wendDailyDateFromSpec(english.spec)).toBe("2026-11-22");
    expect(wendDailyDateFromSpec({ ...english.spec, difficulty: "easy" })).toBeNull();

    const { info, puzzle } = getWendDailyPuzzle("2026-11-22", "en");
    expect(info).toEqual(english);
    expect(puzzle.seed).toBe(english.seed);
    expect(puzzle.language).toBe("en");
    expect(validateWendPuzzle(puzzle).problems).toEqual([]);
    const other = getWendDailyPuzzle("2026-11-22").puzzle;
    expect(puzzle.id).not.toBe(other.id);
    expect(puzzle.letters).not.toEqual(other.letters);
    expect(WEND_BANKS.en.some((theme) => theme.title === puzzle.theme)).toBe(true);
  });

  it("walks a theme deck of its own in English, as long as the English bank", () => {
    const count = WEND_BANKS.en.length;
    const titles = WEND_BANKS.en.map((theme) => theme.title);
    const english: string[] = [];
    const portuguese: string[] = [];
    for (let day = 0; day < count; day++) {
      english.push(getWendDailyPuzzle(addDays("2026-11-23", day), "en").puzzle.theme);
      portuguese.push(getWendDailyPuzzle(addDays("2026-11-23", day)).puzzle.theme);
    }
    for (const theme of english) expect(titles).toContain(theme);
    // One full turn of the deck shows every theme once. A repeat only happens when a theme cannot fill that day's board and another steps in.
    expect(new Set(english).size).toBeGreaterThanOrEqual(count - 2);
    expect(new Set(english.slice(0, 28)).size).toBeGreaterThanOrEqual(27);
    // The deck starts over after its last card.
    expect(getWendDailyPuzzle(addDays("2026-11-23", count), "en").puzzle.theme).toBe(english[0]);
    // The two decks are shuffled apart: the day's theme in one language says nothing about the other.
    const position = (bank: readonly { title: string }[], theme: string) => bank.findIndex((entry) => entry.title === theme);
    expect(english.map((theme) => position(WEND_BANKS.en, theme))).not.toEqual(portuguese.map((theme) => position(WEND_BANKS["pt-br"], theme)));
  });
});
