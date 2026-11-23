import { describe, expect, it } from "vitest";
import { GAMES, difficultyLabel } from "@/games/registry";
import {
  DIFFICULTIES,
  EASY_POOL_SIZE,
  TERMO_DAILY_CONFIG,
  TERMO_MODES,
  TERMO_MODE_NAMES,
  TERMO_TIERS,
  WORD_LENGTH,
  answerWords,
  checkGuess,
  displayWord,
  generateTermoFromSpec,
  generateTermoPuzzle,
  getTermoDailyInfo,
  isKnownWord,
  knownWordCount,
  letterStates,
  plainLetters,
  scoreGuess,
  solvedAt,
  termoDailyDateFromSpec,
  termoDailyVariantFromSpec,
  termoDailyVariantSpec,
  termoPuzzleId,
  termoSeeds,
  termoShareGrid,
  validateTermoPuzzle,
} from "@/games/termo/engine";
import { addDays } from "@/shared/engine/pacific-time";

describe("word lists", () => {
  it("strips accents, the cedilla and anything that is not a letter", () => {
    expect(plainLetters("Avião")).toBe("aviao");
    expect(plainLetters("AÇÚCAR!")).toBe("acucar");
    expect(plainLetters(" é-1 ")).toBe("e");
  });

  it("holds between 1500 and 2500 answers, each five plain letters and listed once", () => {
    const answers = answerWords();
    expect(answers.length).toBeGreaterThanOrEqual(1500);
    expect(answers.length).toBeLessThanOrEqual(2500);
    expect(new Set(answers).size).toBe(answers.length);
    expect(answers.every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
    expect(EASY_POOL_SIZE).toBe(700);
    expect(EASY_POOL_SIZE).toBeLessThan(answers.length);
  });

  it("accepts every answer as a guess, plus verb forms, plurals and loanwords", () => {
    expect(answerWords().every(isKnownWord)).toBe(true);
    expect(knownWordCount()).toBeGreaterThan(9000);
    for (const word of ["falei", "fazia", "gatos", "mesas", "meses", "cafes", "leoes", "outra", "jesus", "mouse"]) expect(isKnownWord(word), word).toBe(true);
    for (const word of ["xxxxx", "abcde", "festa ", "FESTA", "fest", ""]) expect(isKnownWord(word), word).toBe(false);
  });

  it("keeps names, foreign words, verb forms and feminine doubles out of the answers", () => {
    const answers = new Set(answerWords());
    for (const word of ["jesus", "maria", "mouse", "light", "tinha", "falou", "nossa", "linda", "todos", "horas", "neste"]) expect(answers.has(word), word).toBe(false);
    for (const word of ["festa", "campo", "livro", "nuvem", "verao", "tosse", "lapis", "pizza", "sagaz"]) expect(answers.has(word), word).toBe(true);
  });

  it("writes a word back with its accents", () => {
    expect(displayWord("aviao")).toBe("avião");
    expect(displayWord("porem")).toBe("porém");
    expect(displayWord("lapis")).toBe("lápis");
    expect(displayWord("cafes")).toBe("cafés");
    expect(displayWord("festa")).toBe("festa");
    expect(displayWord("xxxxx")).toBe("xxxxx");
  });

  it("shows every answer as the answer itself, five letters long", () => {
    for (const word of answerWords()) {
      const shown = displayWord(word);
      expect([...shown].length, shown).toBe(WORD_LENGTH);
      expect(plainLetters(shown), shown).toBe(word);
    }
  });
});

describe("scoring", () => {
  it("marks letters in the right place, in another position and outside the word", () => {
    expect(scoreGuess("carta", "campo")).toEqual(["right", "right", "wrong", "wrong", "wrong"]);
    expect(scoreGuess("carta", "troca")).toEqual(["place", "place", "wrong", "place", "right"]);
    expect(scoreGuess("carta", "carta")).toEqual(["right", "right", "right", "right", "right"]);
    expect(scoreGuess("carta", "mundo")).toEqual(["wrong", "wrong", "wrong", "wrong", "wrong"]);
  });

  it("gives a repeated letter no more marks than the answer has copies", () => {
    // "carta" has two As and one R. The last A is in place, which leaves one A and one R to hand out.
    expect(scoreGuess("carta", "arara")).toEqual(["place", "place", "wrong", "wrong", "right"]);
    // The answer has one O, already matched in place, so the other O is outside the word.
    expect(scoreGuess("campo", "bolso")).toEqual(["wrong", "wrong", "wrong", "wrong", "right"]);
    // The last two letters are in place. The answer still has an A and an R to match the two that are not.
    expect(scoreGuess("arara", "barra")).toEqual(["wrong", "place", "place", "right", "right"]);
  });

  it("ignores accents: the guess is compared in its plain form", () => {
    const guess = plainLetters("avião");
    expect(scoreGuess("aviao", guess)).toEqual(["right", "right", "right", "right", "right"]);
    expect(scoreGuess(plainLetters("maçãs"), plainLetters("macas"))).toEqual(["right", "right", "right", "right", "right"]);
  });

  it("refuses a short row and an unknown word, each with its own message", () => {
    expect(checkGuess(["f", "e", "s", "", "a"])).toEqual({ code: "incomplete", message: "A palavra precisa ter 5 letras." });
    expect(checkGuess(["f", "e", "s", "t"])?.code).toBe("incomplete");
    expect(checkGuess([..."xxxxx"])).toEqual({ code: "unknown", message: "Essa palavra não está na lista." });
    expect(checkGuess([..."festa"])).toBeNull();
  });

  it("keeps the best mark of each letter for the keyboard and stops at the guess that found the word", () => {
    const states = letterStates("carta", ["troca", "campo"]);
    expect(states.get("c")).toBe("right");
    expect(states.get("a")).toBe("right");
    expect(states.get("t")).toBe("place");
    expect(states.get("o")).toBe("wrong");
    expect(states.get("z")).toBeUndefined();
    expect(solvedAt("carta", ["campo", "carta", "mundo"])).toBe(1);
    // "mundo" came after the word was found, so this board learned nothing from it.
    expect(letterStates("carta", ["campo", "carta", "mundo"]).has("u")).toBe(false);
  });
});

describe("generator", () => {
  it("builds the same puzzle from the same seed, and another from another seed", () => {
    for (const difficulty of DIFFICULTIES) {
      const first = generateTermoPuzzle("repeat", difficulty);
      expect(generateTermoPuzzle("repeat", difficulty)).toEqual(first);
      expect(first.id).toBe(termoPuzzleId(first.seed));
    }
    const words = new Set(Array.from({ length: 40 }, (_, index) => generateTermoPuzzle(`spread-${index}`, "medium").answers[0]));
    expect(words.size).toBeGreaterThan(30);
  });

  it("follows the tier: one, one, two and four words, with six, six, seven and nine guesses", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < 60; index++) {
        const puzzle = generateTermoPuzzle(`tier-${index}`, difficulty);
        expect(puzzle.answers).toHaveLength(TERMO_TIERS[difficulty].boards);
        expect(puzzle.maxGuesses).toBe(TERMO_TIERS[difficulty].maxGuesses);
        expect(new Set(puzzle.answers).size).toBe(puzzle.answers.length);
        expect(validateTermoPuzzle(puzzle)).toEqual({ ok: true, problems: [] });
      }
    }
  });

  it("names the modes Termo, Dueto and Quarteto, each on a tier with that many words", () => {
    expect(TERMO_MODES.map((mode) => [mode.name, TERMO_TIERS[mode.difficulty].boards, TERMO_TIERS[mode.difficulty].maxGuesses])).toEqual([
      ["Termo", 1, 6],
      ["Dueto", 2, 7],
      ["Quarteto", 4, 9],
    ]);
    for (const mode of TERMO_MODES) expect(TERMO_MODE_NAMES[mode.difficulty]).toBe(mode.name);
    expect(TERMO_MODE_NAMES.easy).toBe("Termo");
    // The registry repeats the table for the header, the hub, the result screen and the share text.
    expect(GAMES.termo.difficultyLabels).toEqual(TERMO_MODE_NAMES);
    expect(difficultyLabel(GAMES.termo, "expert")).toBe("Quarteto");
    expect(difficultyLabel(GAMES.zip, "expert")).toBe("expert");
  });

  it("draws easy words from the most common answers only", () => {
    const answers = answerWords();
    let beyond = 0;
    for (let index = 0; index < 200; index++) {
      const easy = generateTermoPuzzle(`pool-${index}`, "easy");
      expect(easy.metadata.ranks[0]).toBeLessThan(EASY_POOL_SIZE);
      expect(easy.answers[0]).toBe(answers[easy.metadata.ranks[0]]);
      if (generateTermoPuzzle(`pool-${index}`, "medium").metadata.ranks[0] >= EASY_POOL_SIZE) beyond++;
    }
    expect(beyond).toBeGreaterThan(50);
  });

  it("pins the words of a known seed, so a change to the lists or the generator is noticed", () => {
    expect(generateTermoPuzzle("example-seed", "expert").answers).toMatchInlineSnapshot(`
      [
        "tosco",
        "palco",
        "baoba",
        "vetor",
      ]
    `);
  });

  it("refuses versions and sizes it does not have", () => {
    expect(() => generateTermoFromSpec({ token: "x", version: 2, difficulty: "easy" })).toThrow(RangeError);
    expect(() => generateTermoFromSpec({ token: "x", version: 1, difficulty: "easy", size: 6 })).toThrow(RangeError);
    expect(termoSeeds.parse("TERMO:x:1:easy:6")).toBeNull();
    expect(termoSeeds.parse("TERMO:x:1:easy")).toEqual({ token: "x", version: 1, difficulty: "easy" });
  });

  it("flags a puzzle that is not playable", () => {
    expect(validateTermoPuzzle({ answers: ["xxxxx"], maxGuesses: 6 }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["festa", "festa"], maxGuesses: 7 }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["festa", "campo"], maxGuesses: 2 }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["festa"], maxGuesses: 6, difficulty: "hard" }).ok).toBe(false);
  });
});

describe("daily", () => {
  it("starts at #1 on the epoch and is one board on every day of the week", () => {
    expect(TERMO_DAILY_CONFIG.epoch).toBe("2026-11-22");
    const first = getTermoDailyInfo("2026-11-22");
    expect(first.number).toBe(1);
    expect(first.seed).toBe("TERMO:2026-11-22:1:medium");
    expect(getTermoDailyInfo("2026-11-23").number).toBe(2);
    for (let day = 0; day < 28; day++) {
      const info = getTermoDailyInfo(addDays("2026-11-22", day));
      expect(info.difficulty).toBe("medium");
      const puzzle = generateTermoFromSpec(info.spec);
      expect(puzzle.answers).toHaveLength(1);
      expect(puzzle.maxGuesses).toBe(6);
    }
  });

  it("has a Dueto and a Quarteto for each date, apart from the daily", () => {
    const dueto = termoDailyVariantSpec("2026-11-23", "dueto");
    const quarteto = termoDailyVariantSpec("2026-11-23", "quarteto");
    expect(termoSeeds.format(dueto)).toBe("TERMO:2026-11-23-dueto:1:hard");
    expect(termoSeeds.format(quarteto)).toBe("TERMO:2026-11-23-quarteto:1:expert");
    expect(generateTermoFromSpec(dueto).answers).toHaveLength(2);
    expect(generateTermoFromSpec(quarteto).answers).toHaveLength(4);
    expect(generateTermoFromSpec(dueto)).toEqual(generateTermoFromSpec(termoSeeds.parse("TERMO:2026-11-23-dueto:1:hard")!));
    // Another date, other words.
    expect(generateTermoFromSpec(termoDailyVariantSpec("2026-11-24", "dueto")).answers).not.toEqual(generateTermoFromSpec(dueto).answers);
    // They are not daily seeds: no number, no streak.
    expect(termoDailyDateFromSpec(dueto)).toBeNull();
    expect(() => termoDailyVariantSpec("2026-02-30", "dueto")).toThrow(RangeError);
  });

  it("recognizes the seed of a day's Dueto or Quarteto and nothing else", () => {
    expect(termoDailyVariantFromSpec(termoDailyVariantSpec("2026-11-23", "dueto"))).toEqual({ date: "2026-11-23", variant: "dueto" });
    expect(termoDailyVariantFromSpec(termoDailyVariantSpec("2026-11-23", "quarteto"))).toEqual({ date: "2026-11-23", variant: "quarteto" });
    expect(termoDailyVariantFromSpec({ token: "2026-11-23-dueto", version: 1, difficulty: "expert" })).toBeNull();
    expect(termoDailyVariantFromSpec({ token: "2026-11-23-trio", version: 1, difficulty: "hard" })).toBeNull();
    expect(termoDailyVariantFromSpec({ token: "2026-02-30-dueto", version: 1, difficulty: "hard" })).toBeNull();
    expect(termoDailyVariantFromSpec({ token: "2026-11-23", version: 1, difficulty: "hard" })).toBeNull();
    expect(termoDailyVariantFromSpec({ token: "lucky-dueto", version: 1, difficulty: "hard" })).toBeNull();
    expect(termoDailyVariantFromSpec(getTermoDailyInfo("2026-11-23").spec)).toBeNull();
  });

  it("recognizes its own daily seeds and no forged ones", () => {
    const info = getTermoDailyInfo("2026-12-01");
    expect(termoDailyDateFromSpec(info.spec)).toBe("2026-12-01");
    expect(termoDailyDateFromSpec({ ...info.spec, difficulty: info.difficulty === "easy" ? "hard" : "easy" })).toBeNull();
    expect(termoDailyDateFromSpec({ token: "lucky", version: 1, difficulty: "easy" })).toBeNull();
  });
});

describe("daily decks", () => {
  it("never repeats the daily word within a year, and keeps the three puzzles of a date apart", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 400; day++) {
      const date = addDays("2026-11-22", day);
      const termo = generateTermoFromSpec(getTermoDailyInfo(date).spec).answers;
      const dueto = generateTermoFromSpec(termoDailyVariantSpec(date, "dueto")).answers;
      const quarteto = generateTermoFromSpec(termoDailyVariantSpec(date, "quarteto")).answers;
      expect([termo.length, dueto.length, quarteto.length]).toEqual([1, 2, 4]);
      expect(new Set([...termo, ...dueto, ...quarteto]).size, date).toBe(7);
      expect(seen.has(termo[0]), `${date}: ${termo[0]} again`).toBe(false);
      seen.add(termo[0]);
    }
  });

  it("gives a date seed of the easy tier a common word", () => {
    for (let day = 0; day < 60; day++) {
      const puzzle = generateTermoFromSpec({ token: addDays("2026-11-22", day), version: 1, difficulty: "easy" });
      expect(puzzle.metadata.ranks[0]).toBeLessThan(EASY_POOL_SIZE);
    }
  });
});

describe("share grid", () => {
  it("draws one row of squares per guess and says how many guesses the word took", () => {
    expect(termoShareGrid({ answers: ["carta"], maxGuesses: 6 }, ["troca", "campo", "carta"])).toBe(["3/6", "🟨🟨⬛🟨🟩", "🟩🟩⬛⬛⬛", "🟩🟩🟩🟩🟩"].join("\n"));
  });

  it("puts two boards side by side and stops each one at the guess that found it", () => {
    const grid = termoShareGrid({ answers: ["carta", "campo"], maxGuesses: 7 }, ["carta", "mundo", "campo"]);
    expect(grid.split("\n")).toEqual(["1/7 3/7", "🟩🟩🟩🟩🟩 🟩🟩⬛⬛⬛", "⬜⬜⬜⬜⬜ 🟨⬛⬛⬛🟩", "⬜⬜⬜⬜⬜ 🟩🟩🟩🟩🟩"]);
  });

  it("marks a word that was not found with an X", () => {
    expect(termoShareGrid({ answers: ["carta", "campo"], maxGuesses: 2 }, ["carta", "mundo"]).split("\n")[0]).toBe("1/2 X/2");
  });
});
