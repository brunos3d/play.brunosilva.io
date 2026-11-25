import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WEND_THEMES as ENGLISH } from "@/games/wend/engine/bank/en";
import { WEND_THEMES as PORTUGUESE } from "@/games/wend/engine/bank/pt-br";
import type { WendTheme } from "@/games/wend/engine/bank/types";
import { WEND_MAX_SIZE, WEND_MIN_SIZE, wendSeeds } from "@/games/wend/engine/seed";
import { WEND_TIERS } from "@/games/wend/engine/config";
import { generateWendFromSpec, loadWendPuzzle, validateWendPuzzle } from "@/games/wend/engine/generator";
import { plainLetters } from "@/games/wend/engine/text";
import { isWendBankLoaded, loadWendBank, parseWendBank, wendThemes } from "@/games/wend/engine/themes";
import { LOCALES } from "@/i18n/config";
import type { GameLanguage } from "@/i18n/game-language";
import { DIFFICULTIES } from "@/shared/engine/difficulty";

/*
 * This file imports the engine's modules one by one, never its index. The
 * index puts every bank in memory, and the tests below need to start the way
 * the browser does: with no bank at all.
 */

const BANKS: Record<GameLanguage, readonly WendTheme[]> = { "pt-br": PORTUGUESE, en: ENGLISH };
const SRC = fileURLToPath(new URL("../../src", import.meta.url));

describe("loading a bank", () => {
  // These run in order: each one leaves one more bank in memory.
  it("refuses to generate while the bank of the language is not in memory, and says how to fix it", () => {
    expect(isWendBankLoaded("en")).toBe(false);
    expect(isWendBankLoaded("pt-br")).toBe(false);
    expect(() => wendThemes("en")).toThrow('The Wend word bank for "en" is not loaded');
    expect(() => generateWendFromSpec({ token: "x", version: 1, difficulty: "easy" })).toThrow('The Wend word bank for "pt-br" is not loaded');
    expect(() => generateWendFromSpec({ token: "x", version: 1, difficulty: "easy", lang: "en" })).toThrow("loadWendBank");
  });

  it("loads the language that was asked for and leaves the other one alone", async () => {
    const themes = await loadWendBank("en");
    expect(themes).toHaveLength(ENGLISH.length);
    expect(isWendBankLoaded("en")).toBe(true);
    expect(isWendBankLoaded("pt-br")).toBe(false);
    expect(wendThemes("en")).toBe(themes);
    // A second call hands back the same bank and parses nothing again.
    expect(await loadWendBank("en")).toBe(themes);
    expect(generateWendFromSpec({ token: "x", version: 1, difficulty: "easy", lang: "en" }).language).toBe("en");
    expect(() => generateWendFromSpec({ token: "x", version: 1, difficulty: "easy" })).toThrow("not loaded");
  });

  it("loads a bank on the way to a puzzle, which is how the app generates", async () => {
    const puzzle = await loadWendPuzzle({ token: "x", version: 1, difficulty: "easy" });
    expect(puzzle.language).toBe("pt-br");
    expect(isWendBankLoaded("pt-br")).toBe(true);
    expect(PORTUGUESE.some((theme) => theme.title === puzzle.theme)).toBe(true);
    expect(await loadWendPuzzle({ token: "x", version: 1, difficulty: "easy" })).toEqual(puzzle);
    expect((await loadWendPuzzle({ token: "x", version: 1, difficulty: "easy", lang: "en" })).seed).toBe("WEND:x:1:easy:en");
  });

  it("rejects a language it has no bank for", async () => {
    await expect(loadWendBank("klingon" as GameLanguage)).rejects.toThrow("no word bank");
  });

  it("has a bank for every language a seed can name", async () => {
    expect(Object.keys(BANKS).sort()).toEqual([...(wendSeeds.languages?.supported ?? [])].sort());
    expect(Object.keys(BANKS).sort()).toEqual([...LOCALES].sort());
    for (const language of LOCALES) expect(await loadWendBank(language)).toHaveLength(BANKS[language].length);
  });
});

describe.each(Object.entries(BANKS) as [GameLanguage, readonly WendTheme[]][])("word bank: %s", (language, bank) => {
  it("holds single words of 3 to 12 plain letters, each once per theme", () => {
    for (const theme of bank) {
      const seen = new Set<string>();
      for (const word of theme.words.split(" ")) {
        const plain = plainLetters(word);
        expect(plain, `${theme.title}: ${word}`).toMatch(/^[A-Z]{3,12}$/);
        expect(seen.has(plain), `${theme.title}: ${word} twice`).toBe(false);
        seen.add(plain);
      }
    }
  });

  it("has unique theme titles that fit the panel, and no em dash anywhere", () => {
    expect(new Set(bank.map((theme) => theme.title)).size).toBe(bank.length);
    for (const theme of bank) {
      // "Estados e capitais do Brasil" is the longest title that has shipped, and it fits next to the counter on a 330 px board.
      expect(theme.title.length, theme.title).toBeLessThanOrEqual(28);
      expect(theme.title.trim(), theme.title).toBe(theme.title);
      expect(`${theme.title} ${theme.words}`, theme.title).not.toContain("\u2014");
    }
  });

  it("has enough different lengths in every theme for the smallest recipe", () => {
    for (const theme of parseWendBank(bank)) {
      const lengths = [...theme.byLength.keys()];
      // An easy board needs four of them between 3 and 7.
      expect(lengths.filter((length) => length >= 3 && length <= 7).length, theme.title).toBeGreaterThanOrEqual(4);
    }
  });

  it("lets every theme fill every board of every tier on its own", () => {
    // With one theme in the bank there is no other theme to fall back on, so a theme that is short of words of some length fails here by name.
    for (const theme of parseWendBank(bank)) {
      for (const difficulty of DIFFICULTIES) {
        const tier = WEND_TIERS[difficulty];
        for (let size = WEND_MIN_SIZE; size <= WEND_MAX_SIZE; size++) {
          const label = `${language} "${theme.title}" ${difficulty} ${size}x${size}`;
          for (const token of ["alone-1", "alone-2"]) {
            const puzzle = generateWendFromSpec(wendSeeds.withLanguage({ token, version: 1, difficulty, size }, language), [theme]);
            expect(puzzle.theme, label).toBe(theme.title);
            expect(validateWendPuzzle(puzzle).problems, label).toEqual([]);
            if (!tier.sizes.includes(size)) continue;
            // On the tier's own board the theme follows the tier's recipe, with no loosened pass.
            expect(puzzle.words.length, label).toBeGreaterThanOrEqual(tier.words[0]);
            expect(puzzle.words.length, label).toBeLessThanOrEqual(tier.words[1]);
            for (const word of puzzle.words) {
              expect(word.text.length, label).toBeGreaterThanOrEqual(tier.lengths[0]);
              expect(word.text.length, label).toBeLessThanOrEqual(tier.lengths[1]);
            }
            // The theme itself yields a single-solution board quickly: well inside its own 16 tries per pass.
            expect(puzzle.metadata.attempts, label).toBeLessThanOrEqual(32);
          }
        }
      }
    }
  });
});

describe("the English bank", () => {
  it("is as broad as the Portuguese one", () => {
    expect(ENGLISH.length).toBeGreaterThanOrEqual(PORTUGUESE.length);
    const words = (bank: readonly WendTheme[]) => bank.reduce((sum, theme) => sum + theme.words.split(" ").length, 0);
    expect(words(ENGLISH)).toBeGreaterThanOrEqual(words(PORTUGUESE));
  });

  it("is written in lower case letters with no accents: no proper nouns, nothing to strip", () => {
    for (const theme of ENGLISH) for (const word of theme.words.split(" ")) expect(word, `${theme.title}: ${word}`).toMatch(/^[a-z]+$/);
  });

  it("keeps to British spelling", () => {
    const all = new Set(ENGLISH.flatMap((theme) => theme.words.split(" ")));
    for (const british of ["grey", "theatre", "aluminium", "yoghurt", "organise", "pyjamas", "doughnut", "harbour", "kilometre", "watercolour", "aeroplane", "moisturiser"]) expect(all.has(british), british).toBe(true);
    for (const american of ["gray", "theater", "aluminum", "yogurt", "organize", "pajamas", "donut", "harbor", "kilometer", "watercolor", "airplane", "color", "center", "meter", "liter", "eggplant", "zucchini", "sidewalk", "truck"]) expect(all.has(american), american).toBe(false);
    expect(ENGLISH.some((theme) => theme.title === "Colours")).toBe(true);
  });

  it("has words of 10 letters or more in nearly every theme, so the hard boards can use distinct lengths", () => {
    const short = parseWendBank(ENGLISH).filter((theme) => ![10, 11, 12].some((length) => theme.byLength.has(length)));
    expect(short.map((theme) => theme.title)).toEqual([]);
  });
});

describe("what the browser downloads", () => {
  /** The files a module pulls in through static imports, followed all the way down. A dynamic `import()` is a separate chunk and is not followed. */
  function staticImports(entry: string): Set<string> {
    const seen = new Set<string>();
    const locate = (from: string, specifier: string): string | null => {
      const base = specifier.startsWith("@/") ? resolve(SRC, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(from), specifier) : null;
      if (!base) return null;
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
      return null;
    };
    const visit = (file: string): void => {
      if (seen.has(file) || !/\.tsx?$/.test(file)) return;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*(?:import|export)\s(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
        const target = locate(file, match[1]);
        if (target) visit(target);
      }
    };
    visit(resolve(SRC, entry));
    return new Set([...seen].map((file) => file.slice(SRC.length + 1).replaceAll("\\", "/")));
  }

  const BANK_FILES = ["games/wend/engine/bank/en.ts", "games/wend/engine/bank/pt-br.ts", "games/wend/engine/bank/all.ts", "games/wend/engine/index.ts"];

  it("follows imports for real", () => {
    // The walker has to see through the engine's index, or the checks below prove nothing.
    const index = staticImports("games/wend/engine/index.ts");
    for (const file of BANK_FILES) expect(index.has(file), file).toBe(true);
    expect(staticImports("games/wend/components/game/daily-game.tsx").has("games/wend/engine/generator/v1.ts")).toBe(true);
  });

  it("gives the game pages no bank up front: each one arrives through loadWendBank", () => {
    for (const entry of ["games/wend/components/game/daily-game.tsx", "games/wend/components/game/seed-game.tsx", "games/wend/components/game/practice.tsx", "games/wend/components/game/debug-panel.tsx"]) {
      const files = staticImports(entry);
      for (const file of BANK_FILES) expect(files.has(file), `${entry} imports ${file}`).toBe(false);
    }
    // The one place that names the bank files does it with import().
    const loader = readFileSync(resolve(SRC, "games/wend/engine/themes.ts"), "utf8");
    expect(loader).toContain('import("./bank/pt-br")');
    expect(loader).toContain('import("./bank/en")');
  });

  it("gives the hub no bank and no generator at all", () => {
    for (const entry of ["shared/ui/hub/hub.tsx", "games/wend/engine/daily.ts", "games/wend/engine/seed.ts", "games/wend/storage/progress.ts"]) {
      const files = [...staticImports(entry)].filter((file) => file.startsWith("games/wend/"));
      for (const file of files) expect(file, `${entry} imports ${file}`).not.toMatch(/games\/wend\/engine\/(bank\/|themes|generator|index)/);
    }
    expect([...staticImports("shared/ui/hub/hub.tsx")].filter((file) => file.startsWith("games/wend/")).sort()).toEqual(["games/wend/engine/daily.ts", "games/wend/engine/seed.ts"]);
  });
});
