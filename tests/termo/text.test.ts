import { beforeAll, describe, expect, it } from "vitest";
import {
  type TermoShape,
  type TermoState,
  boardLabelText,
  checkGuess,
  createTermoGame,
  endText,
  foundText,
  guessErrorText,
  hintText,
  idleText,
  loadTermoWords,
  markText,
  modeSummaryText,
  revealTermo,
  shownWord,
  statusAfter,
  wordListText,
} from "@/games/termo/engine";
import { translator } from "../i18n";

const t = translator("termo");
const pt = translator("termo", "pt-br");

/** Portuguese words. */
const ONE: TermoShape = { answers: ["aviao"], maxGuesses: 6, language: "pt-br" };
const TWO: TermoShape = { answers: ["carta", "lapis"], maxGuesses: 7, language: "pt-br" };
const FOUR: TermoShape = { answers: ["carta", "livro", "campo", "nuvem"], maxGuesses: 9, language: "pt-br" };
/** English words. */
const HOUSE: TermoShape = { answers: ["house"], maxGuesses: 6, language: "en" };
const PAIR: TermoShape = { answers: ["house", "plant"], maxGuesses: 7, language: "en" };

const after = (shape: TermoShape, guesses: string[]): TermoState => ({ ...createTermoGame("p"), guesses, status: statusAfter(shape, guesses) });

beforeAll(async () => {
  await Promise.all([loadTermoWords("pt-br"), loadTermoWords("en")]);
});

describe("the sentences of the game, in the interface language", () => {
  it("says why a row was refused", () => {
    const short = checkGuess(["f", "e", "s", "", ""], "pt-br")!;
    const unknown = checkGuess([..."xxxxx"], "pt-br")!;
    expect(guessErrorText(t, short)).toBe("The word needs 5 letters.");
    expect(guessErrorText(pt, short)).toBe("A palavra precisa ter 5 letras.");
    expect(guessErrorText(t, unknown)).toBe("That word is not in the list.");
    expect(guessErrorText(pt, unknown)).toBe("Essa palavra não está na lista.");
  });

  it("explains how to start, then counts the guesses", () => {
    expect(idleText(t, ONE, createTermoGame("p"))).toBe("Find the word in 6 guesses. Type a 5-letter word and press Enter.");
    expect(idleText(pt, ONE, createTermoGame("p"))).toBe("Descubra a palavra em 6 tentativas. Digite uma palavra de 5 letras e aperte Enter.");
    expect(idleText(t, TWO, createTermoGame("p"))).toBe("Find the 2 words in 7 guesses. Type a 5-letter word and press Enter.");
    expect(idleText(pt, FOUR, createTermoGame("p"))).toBe("Descubra as 4 palavras em 9 tentativas. Digite uma palavra de 5 letras e aperte Enter.");
    expect(idleText(t, ONE, after(ONE, ["campo"]))).toBe("Guess 2 of 6.");
    expect(idleText(pt, ONE, after(ONE, ["campo"]))).toBe("Tentativa 2 de 6.");
  });

  it("says how a won game went", () => {
    expect(endText(t, ONE, after(ONE, ["aviao"]))).toBe("First try! You got the word.");
    expect(endText(pt, ONE, after(ONE, ["aviao"]))).toBe("De primeira! Você acertou a palavra.");
    expect(endText(t, ONE, after(ONE, ["campo", "livro", "aviao"]))).toBe("You got it in 3 guesses.");
    expect(endText(pt, ONE, after(ONE, ["campo", "livro", "aviao"]))).toBe("Você acertou em 3 tentativas.");
    expect(endText(t, TWO, after(TWO, ["carta", "campo", "lapis"]))).toBe("You found the 2 words in 3 guesses.");
    expect(endText(pt, TWO, after(TWO, ["carta", "campo", "lapis"]))).toBe("Você encontrou as 2 palavras em 3 tentativas.");
  });

  it("names the hidden words, written as they are spelled, when the game was lost or revealed", () => {
    const lost = after(ONE, ["campo", "mundo", "livro", "festa", "nuvem", "porta"]);
    expect(lost.status).toBe("lost");
    expect(endText(t, ONE, lost)).toBe("Out of guesses. The word was AVIÃO.");
    expect(endText(pt, ONE, lost)).toBe("Acabaram as tentativas. A palavra era AVIÃO.");
    const revealed = revealTermo(after(TWO, ["campo"]));
    expect(endText(t, TWO, revealed)).toBe("Solution revealed. The words were CARTA and LÁPIS.");
    expect(endText(pt, TWO, revealed)).toBe("Solução revelada. As palavras eram CARTA e LÁPIS.");
    const four = revealTermo(createTermoGame("p"));
    expect(endText(t, FOUR, four)).toBe("Solution revealed. The words were CARTA, LIVRO, CAMPO and NUVEM.");
    expect(endText(pt, FOUR, four)).toBe("Solução revelada. As palavras eram CARTA, LIVRO, CAMPO e NUVEM.");
    expect(endText(pt, ONE, revealTermo(createTermoGame("p")))).toBe("Solução revelada. A palavra era AVIÃO.");
  });

  it("says which word was found and how many are left", () => {
    expect(foundText(t, TWO, after(TWO, ["lapis"]), "lapis")).toBe("LÁPIS found. 1 word to go.");
    expect(foundText(pt, TWO, after(TWO, ["lapis"]), "lapis")).toBe("LÁPIS encontrada. Falta 1 palavra.");
    expect(foundText(t, FOUR, after(FOUR, ["carta"]), "carta")).toBe("CARTA found. 3 words to go.");
    expect(foundText(pt, FOUR, after(FOUR, ["carta"]), "carta")).toBe("CARTA encontrada. Faltam 3 palavras.");
  });

  it("gives a hint as a position and a letter, and names the board when there are several", () => {
    expect(hintText(t, ONE, { board: 0, index: 0 })).toBe("The 1st letter is A.");
    expect(hintText(t, ONE, { board: 0, index: 1 })).toBe("The 2nd letter is V.");
    expect(hintText(t, ONE, { board: 0, index: 2 })).toBe("The 3rd letter is I.");
    expect(hintText(t, ONE, { board: 0, index: 4 })).toBe("The 5th letter is O.");
    expect(hintText(pt, ONE, { board: 0, index: 0 })).toBe("A 1ª letra é A.");
    expect(hintText(t, TWO, { board: 1, index: 3 })).toBe("In word 2, the 4th letter is I.");
    expect(hintText(pt, TWO, { board: 1, index: 3 })).toBe("Na palavra 2, a 4ª letra é I.");
    expect(hintText(t, ONE, null)).toBe("You already know every letter. All that is left is to put the word together.");
    expect(hintText(pt, ONE, null)).toBe("Você já conhece todas as letras. Falta só montar a palavra.");
  });

  it("labels the board, the marks and the modes", () => {
    expect(boardLabelText(t, ONE)).toBe("Termo: one 5-letter word, 6 guesses.");
    expect(boardLabelText(pt, ONE)).toBe("Termo: uma palavra de 5 letras, 6 tentativas.");
    expect(boardLabelText(t, FOUR)).toBe("Termo: 4 5-letter words, 9 guesses. Every guess is played on all of them.");
    expect(boardLabelText(pt, FOUR)).toBe("Termo: 4 palavras de 5 letras, 9 tentativas. Cada palpite vale para todas.");
    expect([markText(t, "right"), markText(t, "place"), markText(t, "wrong")]).toEqual(["in the right place", "in another position", "not in the word"]);
    expect([markText(pt, "right"), markText(pt, "place"), markText(pt, "wrong")]).toEqual(["no lugar certo", "em outra posição", "fora da palavra"]);
    expect(modeSummaryText(t, "medium")).toBe("1 word, 6 guesses");
    expect(modeSummaryText(t, "hard")).toBe("2 words at once, 7 guesses");
    expect(modeSummaryText(t, "expert")).toBe("4 words at once, 9 guesses");
    expect(modeSummaryText(pt, "medium")).toBe("1 palavra, 6 tentativas");
    expect(modeSummaryText(pt, "expert")).toBe("4 palavras ao mesmo tempo, 9 tentativas");
  });

  it("joins a list of words with the interface's word for 'and'", () => {
    expect(wordListText(t, ["A"])).toBe("A");
    expect(wordListText(t, ["A", "B"])).toBe("A and B");
    expect(wordListText(pt, ["A", "B", "C"])).toBe("A, B e C");
  });
});

describe("two languages at once", () => {
  it("keeps the words in the game language whatever the interface is", () => {
    // English words under a Portuguese interface.
    const lost = revealTermo(createTermoGame("p"));
    expect(endText(pt, HOUSE, lost)).toBe("Solução revelada. A palavra era HOUSE.");
    expect(endText(pt, PAIR, lost)).toBe("Solução revelada. As palavras eram HOUSE e PLANT.");
    expect(foundText(pt, PAIR, after(PAIR, ["plant"]), "plant")).toBe("PLANT encontrada. Falta 1 palavra.");
    expect(hintText(pt, HOUSE, { board: 0, index: 0 })).toBe("A 1ª letra é H.");
    // Portuguese words under an English interface.
    expect(endText(t, ONE, lost)).toBe("Solution revealed. The word was AVIÃO.");
    expect(hintText(t, TWO, { board: 1, index: 1 })).toBe("In word 2, the 2nd letter is A.");
  });

  it("writes accents back for Portuguese words only", () => {
    expect(shownWord("aviao", "pt-br")).toBe("AVIÃO");
    expect(shownWord("lapis", "pt-br")).toBe("LÁPIS");
    expect(shownWord("house", "en")).toBe("HOUSE");
  });
});
