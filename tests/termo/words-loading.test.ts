import { describe, expect, it } from "vitest";
import { answerWords, checkGuess, displayWord, generateTermoPuzzle, hasTermoWords, isKnownWord, loadTermoPuzzle, loadTermoWords, termoSeeds } from "@/games/termo/engine";
import { fromTermoSnapshot } from "@/games/termo/storage/progress";

/**
 * This file starts with no word list loaded, as the browser does. The other
 * Termo tests load both languages up front. The tests here run in order and
 * share the module's state on purpose.
 */
describe("word lists load one language at a time", () => {
  it("has nothing loaded at first, and says so clearly", () => {
    expect(hasTermoWords("pt-br")).toBe(false);
    expect(hasTermoWords("en")).toBe(false);
    expect(() => answerWords("pt-br")).toThrow(/"pt-br" is not loaded.*loadTermoWords\("pt-br"\)/);
    expect(() => isKnownWord("festa", "pt-br")).toThrow(/not loaded/);
    expect(() => displayWord("festa", "en")).toThrow(/"en" is not loaded/);
    expect(() => checkGuess([..."festa"], "pt-br")).toThrow(/not loaded/);
    expect(() => generateTermoPuzzle("lucky", "medium")).toThrow(/not loaded/);
    expect(() => fromTermoSnapshot("p", { answers: ["festa"], maxGuesses: 6, language: "pt-br" }, { snapshotVersion: 1, puzzleId: "p", guesses: ["campo"] })).toThrow(/not loaded/);
  });

  it("loads Portuguese without touching English", async () => {
    await loadTermoWords("pt-br");
    expect(hasTermoWords("pt-br")).toBe(true);
    expect(hasTermoWords("en")).toBe(false);
    expect(generateTermoPuzzle("lucky", "medium").language).toBe("pt-br");
    expect(() => generateTermoPuzzle("lucky", "medium", { language: "en" })).toThrow(/"en" is not loaded/);
    expect(() => isKnownWord("house", "en")).toThrow(/"en" is not loaded/);
  });

  it("loads the language of a seed when a puzzle is asked for, and only once", async () => {
    const puzzle = await loadTermoPuzzle(termoSeeds.parse("TERMO:lucky:1:medium:en")!);
    expect(puzzle.language).toBe("en");
    expect(hasTermoWords("en")).toBe(true);
    const list = answerWords("en");
    await loadTermoWords("en");
    await Promise.all([loadTermoWords("en"), loadTermoWords("pt-br")]);
    // The same array: a second load does not cut the list up again.
    expect(answerWords("en")).toBe(list);
  });

  it("refuses a language it has no list for", async () => {
    await expect(loadTermoWords("fr" as never)).rejects.toThrow(RangeError);
  });
});
