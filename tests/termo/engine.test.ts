import { beforeAll, describe, expect, it } from "vitest";
import { GAMES, difficultyLabel } from "@/games/registry";
import {
  DIFFICULTIES,
  TERMO_DAILY_CONFIG,
  TERMO_EXAMPLES,
  TERMO_MODES,
  TERMO_MODE_NAMES,
  TERMO_TIERS,
  WORD_LENGTH,
  answerWords,
  checkGuess,
  displayWord,
  easyPoolSize,
  generateTermoFromSpec,
  generateTermoPuzzle,
  getTermoDailyInfo,
  isKnownWord,
  knownWordCount,
  letterStates,
  loadTermoPuzzle,
  loadTermoWords,
  plainLetters,
  scoreGuess,
  solvedAt,
  termoDailyDateFromSpec,
  termoDailyVariantFromSpec,
  termoDailyVariantSpec,
  termoLanguage,
  termoPuzzleId,
  termoSeeds,
  termoShareGrid,
  validateTermoPuzzle,
} from "@/games/termo/engine";
import { addDays } from "@/shared/engine/pacific-time";

const PT = "pt-br";
const EN = "en";

// The lists load on demand, one language at a time. These tests use both.
beforeAll(async () => {
  await Promise.all([loadTermoWords(PT), loadTermoWords(EN)]);
});

describe("word lists", () => {
  it("strips accents, the cedilla and anything that is not a letter", () => {
    expect(plainLetters("Avião")).toBe("aviao");
    expect(plainLetters("AÇÚCAR!")).toBe("acucar");
    expect(plainLetters(" é-1 ")).toBe("e");
  });

  it("holds between 1500 and 2500 answers, each five plain letters and listed once", () => {
    const answers = answerWords(PT);
    expect(answers.length).toBeGreaterThanOrEqual(1500);
    expect(answers.length).toBeLessThanOrEqual(2500);
    expect(new Set(answers).size).toBe(answers.length);
    expect(answers.every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
    expect(easyPoolSize(PT)).toBe(700);
    expect(easyPoolSize(PT)).toBeLessThan(answers.length);
  });

  it("accepts every answer as a guess, plus verb forms, plurals and loanwords", () => {
    expect(answerWords(PT).every((word) => isKnownWord(word, PT))).toBe(true);
    expect(knownWordCount(PT)).toBeGreaterThan(9000);
    for (const word of ["falei", "fazia", "gatos", "mesas", "meses", "cafes", "leoes", "outra", "jesus", "mouse"]) expect(isKnownWord(word, PT), word).toBe(true);
    for (const word of ["xxxxx", "abcde", "festa ", "FESTA", "fest", ""]) expect(isKnownWord(word, PT), word).toBe(false);
  });

  it("keeps names, foreign words, verb forms and feminine doubles out of the answers", () => {
    const answers = new Set(answerWords(PT));
    for (const word of ["jesus", "maria", "mouse", "light", "tinha", "falou", "nossa", "linda", "todos", "horas", "neste"]) expect(answers.has(word), word).toBe(false);
    for (const word of ["festa", "campo", "livro", "nuvem", "verao", "tosse", "lapis", "pizza", "sagaz"]) expect(answers.has(word), word).toBe(true);
  });

  it("writes a word back with its accents", () => {
    expect(displayWord("aviao", PT)).toBe("avião");
    expect(displayWord("porem", PT)).toBe("porém");
    expect(displayWord("lapis", PT)).toBe("lápis");
    expect(displayWord("cafes", PT)).toBe("cafés");
    expect(displayWord("festa", PT)).toBe("festa");
    expect(displayWord("xxxxx", PT)).toBe("xxxxx");
  });

  it("shows every answer as the answer itself, five letters long", () => {
    for (const word of answerWords(PT)) {
      const shown = displayWord(word, PT);
      expect([...shown].length, shown).toBe(WORD_LENGTH);
      expect(plainLetters(shown), shown).toBe(word);
    }
  });
});

describe("English word lists", () => {
  it("holds between 1500 and 2500 answers, each five letters a to z and listed once", () => {
    const answers = answerWords(EN);
    expect(answers.length).toBeGreaterThanOrEqual(1500);
    expect(answers.length).toBeLessThanOrEqual(2500);
    expect(new Set(answers).size).toBe(answers.length);
    expect(answers.every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
    expect(easyPoolSize(EN)).toBe(700);
    expect(easyPoolSize(EN)).toBeLessThan(answers.length);
  });

  it("accepts every answer as a guess, plus plurals, verb forms and both spellings of a word", () => {
    expect(answerWords(EN).every((word) => isKnownWord(word, EN))).toBe(true);
    expect(knownWordCount(EN)).toBeGreaterThan(8000);
    for (const word of ["years", "boxes", "asked", "moved", "going", "color", "fibre", "fiber", "tyres", "china", "wrote"]) expect(isKnownWord(word, EN), word).toBe(true);
    for (const word of ["xxxxx", "abcde", "house ", "HOUSE", "hous", ""]) expect(isKnownWord(word, EN), word).toBe(false);
  });

  it("keeps plurals, regular verb forms, names, one-dialect spellings and offensive words out of the answers", () => {
    const answers = new Set(answerWords(EN));
    for (const word of ["years", "boxes", "flies", "asked", "moved", "tried", "going", "using", "china", "peter", "color", "fibre", "bitch", "gonna", "older"]) expect(answers.has(word), word).toBe(false);
    for (const word of ["house", "plant", "money", "water", "thing", "being", "among", "wrote", "glass", "focus", "pizza", "queen", "zebra"]) expect(answers.has(word), word).toBe(true);
  });

  it("starts with the most common words, which is what the easy tier draws from", () => {
    const answers = answerWords(EN);
    const rank = (word: string) => answers.indexOf(word);
    expect(answers.slice(0, 5)).toEqual(["which", "their", "there", "other", "would"]);
    for (const word of ["water", "house", "money", "night", "green"]) expect(rank(word), word).toBeLessThan(easyPoolSize(EN));
    for (const word of ["igloo", "kayak", "gecko"]) expect(rank(word), word).toBeGreaterThan(easyPoolSize(EN));
  });

  it("has no accents to write back", () => {
    for (const word of answerWords(EN)) expect(displayWord(word, EN)).toBe(word);
    expect(displayWord("xxxxx", EN)).toBe("xxxxx");
  });

  it("is a list of its own: a word of one language is not a word of the other", () => {
    expect(isKnownWord("house", EN)).toBe(true);
    expect(isKnownWord("house", PT)).toBe(false);
    expect(isKnownWord("festa", PT)).toBe(true);
    expect(isKnownWord("festa", EN)).toBe(false);
    // Under a third of the answers of one language are even accepted as a guess in the other.
    const shared = answerWords(EN).filter((word) => isKnownWord(word, PT)).length;
    expect(shared).toBeLessThan(answerWords(EN).length / 3);
  });

  it("gives the tutorial three example words per language, each a word of that language", () => {
    for (const language of [PT, EN] as const) {
      expect(TERMO_EXAMPLES[language].map((example) => example.mark)).toEqual(["right", "place", "wrong"]);
      for (const example of TERMO_EXAMPLES[language]) {
        expect(isKnownWord(example.word, language), example.word).toBe(true);
        expect(example.at).toBeLessThan(WORD_LENGTH);
        // The marked letter appears once, so the sentence about it is not ambiguous.
        expect(example.word.split(example.word[example.at]).length - 1, example.word).toBe(1);
      }
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
    expect(checkGuess(["f", "e", "s", "", "a"], PT)).toEqual({ code: "incomplete", message: "A palavra precisa ter 5 letras." });
    expect(checkGuess(["f", "e", "s", "t"], PT)?.code).toBe("incomplete");
    expect(checkGuess([..."xxxxx"], PT)).toEqual({ code: "unknown", message: "Essa palavra não está na lista." });
    expect(checkGuess([..."festa"], PT)).toBeNull();
  });

  it("checks a guess against the list of the puzzle's language", () => {
    expect(checkGuess([..."house"], EN)).toBeNull();
    expect(checkGuess([..."house"], PT)?.code).toBe("unknown");
    expect(checkGuess([..."festa"], EN)?.code).toBe("unknown");
    expect(checkGuess(["h", "o", "u", "s", ""], EN)?.code).toBe("incomplete");
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
      expect(first.language).toBe(PT);
    }
    const words = new Set(Array.from({ length: 40 }, (_, index) => generateTermoPuzzle(`spread-${index}`, "medium").answers[0]));
    expect(words.size).toBeGreaterThan(30);
  });

  it("follows the tier: one, one, two and four words, with six, six, seven and nine guesses", () => {
    for (const language of [PT, EN] as const) {
      for (const difficulty of DIFFICULTIES) {
        for (let index = 0; index < 60; index++) {
          const puzzle = generateTermoPuzzle(`tier-${index}`, difficulty, { language });
          expect(puzzle.answers).toHaveLength(TERMO_TIERS[difficulty].boards);
          expect(puzzle.maxGuesses).toBe(TERMO_TIERS[difficulty].maxGuesses);
          expect(new Set(puzzle.answers).size).toBe(puzzle.answers.length);
          expect(validateTermoPuzzle(puzzle)).toEqual({ ok: true, problems: [] });
        }
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
    for (const language of [PT, EN] as const) {
      const answers = answerWords(language);
      let beyond = 0;
      for (let index = 0; index < 200; index++) {
        const easy = generateTermoPuzzle(`pool-${index}`, "easy", { language });
        expect(easy.metadata.ranks[0]).toBeLessThan(easyPoolSize(language));
        expect(easy.answers[0]).toBe(answers[easy.metadata.ranks[0]]);
        if (generateTermoPuzzle(`pool-${index}`, "medium", { language }).metadata.ranks[0] >= easyPoolSize(language)) beyond++;
      }
      expect(beyond).toBeGreaterThan(50);
    }
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
    expect(validateTermoPuzzle({ answers: ["xxxxx"], maxGuesses: 6, language: PT }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["festa", "festa"], maxGuesses: 7, language: PT }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["festa", "campo"], maxGuesses: 2, language: PT }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["festa"], maxGuesses: 6, difficulty: "hard", language: PT }).ok).toBe(false);
    // A word of the other language is not an answer of this one.
    expect(validateTermoPuzzle({ answers: ["festa"], maxGuesses: 6, language: PT }).ok).toBe(true);
    expect(validateTermoPuzzle({ answers: ["festa"], maxGuesses: 6, language: EN }).ok).toBe(false);
    expect(validateTermoPuzzle({ answers: ["house"], maxGuesses: 6, language: EN }).ok).toBe(true);
  });
});

describe("English seeds", () => {
  it("carry the language, and a seed without one is Portuguese", () => {
    expect(termoLanguage(termoSeeds.parse("TERMO:lucky:1:hard")!)).toBe(PT);
    expect(termoLanguage(termoSeeds.parse("TERMO:lucky:1:hard:en")!)).toBe(EN);
    expect(termoSeeds.parse("TERMO:lucky:1:hard:fr")).toBeNull();
    const english = generateTermoFromSpec(termoSeeds.parse("TERMO:lucky:1:hard:en")!);
    expect(english).toMatchObject({ seed: "TERMO:lucky:1:hard:en", language: EN });
    expect(english.answers.every((word) => answerWords(EN).includes(word))).toBe(true);
    // The Portuguese puzzle of the same token is another puzzle, with another id and so another saved board.
    const portuguese = generateTermoFromSpec(termoSeeds.parse("TERMO:lucky:1:hard")!);
    expect(portuguese).toMatchObject({ seed: "TERMO:lucky:1:hard", language: PT });
    expect(portuguese.id).not.toBe(english.id);
    expect(portuguese.answers.every((word) => answerWords(PT).includes(word))).toBe(true);
  });

  it("build the same puzzle every time, and another from another seed", () => {
    for (const difficulty of DIFFICULTIES) {
      const first = generateTermoPuzzle("repeat", difficulty, { language: EN });
      expect(generateTermoPuzzle("repeat", difficulty, { language: EN })).toEqual(first);
      expect(generateTermoFromSpec(termoSeeds.parse(first.seed)!)).toEqual(first);
      expect(first.seed).toBe(`TERMO:repeat:1:${difficulty}:en`);
      expect(first.id).toBe(termoPuzzleId(first.seed));
    }
    const words = new Set(Array.from({ length: 40 }, (_, index) => generateTermoPuzzle(`spread-${index}`, "medium", { language: EN }).answers[0]));
    expect(words.size).toBeGreaterThan(30);
  });

  it("pins the English words of a known seed", () => {
    expect(generateTermoPuzzle("example-seed", "expert", { language: EN }).answers).toMatchInlineSnapshot(`
      [
        "flare",
        "cough",
        "rerun",
        "lance",
      ]
    `);
    expect(generateTermoFromSpec(getTermoDailyInfo("2026-11-25", EN).spec).answers).toMatchInlineSnapshot(`
      [
        "minus",
      ]
    `);
  });

  it("loads the list of the seed's language before building, for the browser", async () => {
    const puzzle = await loadTermoPuzzle(termoSeeds.parse("TERMO:lucky:1:medium:en")!);
    expect(puzzle).toEqual(generateTermoFromSpec(termoSeeds.parse("TERMO:lucky:1:medium:en")!));
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

describe("the English daily", () => {
  it("is the same date, number and tier as the Portuguese one, with its own seed and result", () => {
    const portuguese = getTermoDailyInfo("2026-11-25", PT);
    const english = getTermoDailyInfo("2026-11-25", EN);
    expect(getTermoDailyInfo("2026-11-25")).toEqual(portuguese);
    expect(portuguese).toMatchObject({ number: 4, difficulty: "medium", seed: "TERMO:2026-11-25:1:medium" });
    expect(portuguese.variant).toBeUndefined();
    expect(english).toMatchObject({ number: 4, difficulty: "medium", seed: "TERMO:2026-11-25:1:medium:en", variant: "en" });
    expect(termoDailyDateFromSpec(english.spec)).toBe("2026-11-25");
    expect(termoPuzzleId(english.seed)).not.toBe(termoPuzzleId(portuguese.seed));
  });

  it("deals from its own deck: an English word every day, whatever the Portuguese word is", () => {
    const english = new Set(answerWords(EN));
    const portuguese = new Set(answerWords(PT));
    let sameWord = 0;
    let sameRank = 0;
    for (let day = 0; day < 400; day++) {
      const date = addDays("2026-11-22", day);
      const en = generateTermoFromSpec(getTermoDailyInfo(date, EN).spec);
      const pt = generateTermoFromSpec(getTermoDailyInfo(date, PT).spec);
      expect(en.language).toBe(EN);
      expect(english.has(en.answers[0]), `${date}: ${en.answers[0]}`).toBe(true);
      expect(portuguese.has(pt.answers[0]), `${date}: ${pt.answers[0]}`).toBe(true);
      expect(en.metadata.poolSize).toBe(english.size);
      expect(pt.metadata.poolSize).toBe(portuguese.size);
      if (en.answers[0] === pt.answers[0]) sameWord++;
      if (en.metadata.ranks[0] === pt.metadata.ranks[0]) sameRank++;
    }
    // Two decks shuffled apart agree on a card about once in two thousand days. A shared deck would agree every day.
    expect(sameRank).toBeLessThan(5);
    expect(sameWord).toBeLessThan(5);
  });

  it("has its own Dueto and Quarteto of the day, which follow the English Termo", () => {
    const dueto = termoDailyVariantSpec("2026-11-23", "dueto", EN);
    const quarteto = termoDailyVariantSpec("2026-11-23", "quarteto", EN);
    expect(termoSeeds.format(dueto)).toBe("TERMO:2026-11-23-dueto:1:hard:en");
    expect(termoSeeds.format(quarteto)).toBe("TERMO:2026-11-23-quarteto:1:expert:en");
    expect(termoDailyVariantSpec("2026-11-23", "dueto", PT)).toEqual(termoDailyVariantSpec("2026-11-23", "dueto"));
    expect(termoDailyVariantFromSpec(dueto)).toEqual({ date: "2026-11-23", variant: "dueto" });
    expect(termoDailyVariantFromSpec(termoSeeds.parse("TERMO:2026-11-23-quarteto:1:expert:en")!)).toEqual({ date: "2026-11-23", variant: "quarteto" });
    expect(termoDailyVariantFromSpec({ token: "2026-11-23-dueto", version: 1, difficulty: "expert", lang: EN })).toBeNull();
    expect(termoDailyDateFromSpec(dueto)).toBeNull();
    const words = generateTermoFromSpec(dueto);
    expect(words.language).toBe(EN);
    expect(words.answers).toHaveLength(2);
    expect(words.answers.every((word) => answerWords(EN).includes(word))).toBe(true);
    expect(generateTermoFromSpec(quarteto).answers).toHaveLength(4);
    expect(words.answers).not.toEqual(generateTermoFromSpec(termoDailyVariantSpec("2026-11-23", "dueto")).answers);
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

  it("does the same in English: no daily word twice in a year, and the day's three puzzles never share a word", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 400; day++) {
      const date = addDays("2026-11-22", day);
      const termo = generateTermoFromSpec(getTermoDailyInfo(date, EN).spec).answers;
      const dueto = generateTermoFromSpec(termoDailyVariantSpec(date, "dueto", EN)).answers;
      const quarteto = generateTermoFromSpec(termoDailyVariantSpec(date, "quarteto", EN)).answers;
      expect([termo.length, dueto.length, quarteto.length]).toEqual([1, 2, 4]);
      expect(new Set([...termo, ...dueto, ...quarteto]).size, date).toBe(7);
      expect(seen.has(termo[0]), `${date}: ${termo[0]} again`).toBe(false);
      seen.add(termo[0]);
    }
  });

  it("gives a date seed of the easy tier a common word", () => {
    for (const language of [PT, EN] as const) {
      for (let day = 0; day < 60; day++) {
        const puzzle = generateTermoFromSpec(termoSeeds.withLanguage({ token: addDays("2026-11-22", day), version: 1, difficulty: "easy" }, language));
        expect(puzzle.metadata.ranks[0]).toBeLessThan(easyPoolSize(language));
      }
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
