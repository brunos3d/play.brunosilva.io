import { describe, expect, it } from "vitest";
import { WEND_TUTORIALS } from "@/games/wend/components/tutorial/tutorial-puzzle";
import { applyWendHint, createWendGame, elsewhereText, endText, foundText, generateWendPuzzle, hintText, idleText, lengthsText, startStroke, moveStroke, endStroke } from "@/games/wend/engine";
import { messageKeys, messagesOf, translator } from "../i18n";

/*
 * The sentences of the game follow the interface locale. The words in them
 * come from the board, so they follow the game language. These tests read the
 * real message files, in both locales, and mix the two on purpose.
 */
const en = translator("wend");
const pt = translator("wend", "pt-br");

describe("word lengths", () => {
  it("joins lengths the way each language lists things", () => {
    expect(lengthsText(en, [5])).toBe("5");
    expect(lengthsText(en, [5, 6])).toBe("5 and 6");
    expect(lengthsText(en, [5, 6, 7, 8, 9, 10])).toBe("5, 6, 7, 8, 9 and 10");
    expect(lengthsText(pt, [5])).toBe("5");
    expect(lengthsText(pt, [5, 6])).toBe("5 e 6");
    expect(lengthsText(pt, [5, 6, 7])).toBe("5, 6 e 7");
    // A board may use a length twice.
    expect(lengthsText(en, [4, 5, 5, 6])).toBe("4, 5, 5 and 6");
    expect(lengthsText(en, [])).toBe("");
  });
});

describe("idle text", () => {
  it("states the task at the start", () => {
    expect(idleText(en, [3, 4, 5, 6, 7], 5)).toBe("Find 5 hidden words, of 3, 4, 5, 6 and 7 letters. Each letter is used only once.");
    expect(idleText(pt, [3, 4, 5, 6, 7], 5)).toBe("Encontre 5 palavras escondidas, de 3, 4, 5, 6 e 7 letras. Cada letra é usada uma só vez.");
  });

  it("counts the words that are left, with the singular it needs", () => {
    expect(idleText(en, [3, 4, 5, 6, 7], 3)).toBe("3 words to go. Each letter is used only once.");
    expect(idleText(en, [3, 4, 5, 6, 7], 1)).toBe("1 word to go. It uses every letter that is left.");
    expect(idleText(pt, [3, 4, 5, 6, 7], 3)).toBe("Faltam 3 palavras. Cada letra é usada uma só vez.");
    expect(idleText(pt, [3, 4, 5, 6, 7], 1)).toBe("Falta 1 palavra. Ela usa todas as letras que sobraram.");
  });

  it("describes a real board in either interface language", () => {
    const puzzle = generateWendPuzzle("e2e-wend-1", "easy");
    const lengths = puzzle.words.map((word) => word.text.length);
    expect(lengths).toEqual([4, 5, 6, 7]);
    expect(idleText(en, lengths, lengths.length)).toBe("Find 4 hidden words, of 4, 5, 6 and 7 letters. Each letter is used only once.");
    expect(idleText(pt, lengths, lengths.length)).toBe("Encontre 4 palavras escondidas, de 4, 5, 6 e 7 letras. Cada letra é usada uma só vez.");
  });
});

describe("status", () => {
  it("names the word that was found and says what is left", () => {
    expect(foundText(en, "PEAR", 3)).toBe("PEAR! 3 words to go.");
    expect(foundText(en, "PEAR", 1)).toBe("PEAR! 1 word to go.");
    expect(foundText(en, "PEAR", 0)).toBe("PEAR! That was the last word.");
    expect(foundText(pt, "FIGO", 3)).toBe("FIGO! Faltam 3 palavras.");
    expect(foundText(pt, "FIGO", 1)).toBe("FIGO! Falta 1 palavra.");
    expect(foundText(pt, "FIGO", 0)).toBe("FIGO! Era a última palavra.");
  });

  it("keeps a word as the board spells it, whatever the interface language", () => {
    // An English interface over Portuguese words, accents and all, and the reverse.
    expect(foundText(en, "MAÇÃ", 2)).toBe("MAÇÃ! 2 words to go.");
    expect(foundText(pt, "PINEAPPLE", 2)).toBe("PINEAPPLE! Faltam 2 palavras.");
    expect(elsewhereText(en, "CASA")).toBe("CASA is on the board, but it runs through other cells.");
    expect(elsewhereText(pt, "CASA")).toBe("CASA está no tabuleiro, mas passa por outras casas.");
  });

  it("ends a game in two ways", () => {
    expect(endText(en, false)).toBe("Solved. Every word found.");
    expect(endText(en, true)).toBe("Solution revealed.");
    expect(endText(pt, false)).toBe("Resolvido. Todas as palavras encontradas.");
    expect(endText(pt, true)).toBe("Solução revelada.");
  });

  it("has the short lines the hook says as they are", () => {
    expect(en("status.erased")).toBe("Trail erased.");
    expect(pt("status.erased")).toBe("Traço apagado.");
    expect(en("status.undone")).toBe("Last trail undone.");
    expect(pt("status.undone")).toBe("Último traço desfeito.");
    expect(en("status.reset")).toBe("Loose trails erased. Found words stay, and the clock keeps running.");
    expect(pt("status.reset")).toBe("Traços soltos apagados. As palavras encontradas ficam, e o relógio continua correndo.");
    expect(en("status.revealing")).toBe("Revealing the solution.");
    expect(pt("status.revealing")).toBe("Revelando a solução.");
  });
});

describe("hints", () => {
  it("says which letter was revealed", () => {
    expect(hintText(en, { cleared: 0, first: true, found: false }, "PEAR")).toBe("First letter of a word revealed.");
    expect(hintText(en, { cleared: 0, first: false, found: false }, "PEAR")).toBe("Next letter revealed.");
    expect(hintText(en, { cleared: 0, first: false, found: true }, "PEAR")).toBe("Last letter revealed: PEAR.");
    expect(hintText(pt, { cleared: 0, first: true, found: false }, "FIGO")).toBe("Primeira letra de uma palavra revelada.");
    expect(hintText(pt, { cleared: 0, first: false, found: false }, "FIGO")).toBe("Próxima letra revelada.");
    expect(hintText(pt, { cleared: 0, first: false, found: true }, "FIGO")).toBe("Última letra revelada: FIGO.");
  });

  it("says first when it erased trails that led nowhere", () => {
    expect(hintText(en, { cleared: 1, first: true, found: false }, "PEAR")).toBe("Error fixed. First letter of a word revealed.");
    expect(hintText(en, { cleared: 2, first: false, found: false }, "PEAR")).toBe("Errors fixed. Next letter revealed.");
    expect(hintText(en, { cleared: 3, first: false, found: true }, "PEAR")).toBe("Errors fixed. Last letter revealed: PEAR.");
    expect(hintText(pt, { cleared: 1, first: true, found: false }, "FIGO")).toBe("Erro corrigido. Primeira letra de uma palavra revelada.");
    expect(hintText(pt, { cleared: 2, first: false, found: false }, "FIGO")).toBe("Erros corrigidos. Próxima letra revelada.");
    expect(hintText(pt, { cleared: 1, first: false, found: true }, "FIGO")).toBe("Erro corrigido. Última letra revelada: FIGO.");
  });

  it("reads the engine's own hint steps", () => {
    const { puzzle } = WEND_TUTORIALS.en;
    // A wrong trail first: I, F leads nowhere.
    const started = startStroke(puzzle, createWendGame(puzzle.id), 1)!;
    const moved = moveStroke(puzzle, started.state, started.stroke, 0);
    const drawn = endStroke(puzzle, moved.state, moved.stroke).state;
    const first = applyWendHint(puzzle, drawn)!;
    expect(hintText(en, first, puzzle.words[first.word].display)).toBe("Error fixed. First letter of a word revealed.");
    const second = applyWendHint(puzzle, first.state)!;
    expect(hintText(pt, second, puzzle.words[second.word].display)).toBe("Próxima letra revelada.");
    const third = applyWendHint(puzzle, second.state)!;
    expect(hintText(en, third, puzzle.words[third.word].display)).toBe("Last letter revealed: FIG.");
    expect(hintText(pt, third, puzzle.words[third.word].display)).toBe("Última letra revelada: FIG.");
  });
});

describe("the board for screen readers", () => {
  it("labels the board, its cells and the word list", () => {
    expect(en("board.label", { size: 7 })).toBe("Wend board, 7 by 7. Arrow keys move the cursor, Enter marks the letter and Backspace takes the last letter off the trail.");
    expect(pt("board.label", { size: 7 })).toBe("Tabuleiro do Wend, 7 por 7. As setas movem o cursor, Enter marca a letra e Backspace tira a última letra do traço.");
    expect(en("board.tutorialLabel", { size: 3 })).toBe("Tutorial board, 3 by 3");
    expect([en("board.cell", { row: 2, column: 3 }), en("board.letter", { letter: "A" }), en("board.onTrail", { index: 2, count: 4 })].join(" ")).toBe("Row 2, column 3. Letter A. Letter 2 of a trail of 4.");
    expect([pt("board.cell", { row: 2, column: 3 }), pt("board.letter", { letter: "A" }), pt("board.found", { word: "MAÇÃ" })].join(" ")).toBe("Linha 2, coluna 3. Letra A. Parte da palavra MAÇÃ, já encontrada.");
    expect([en("board.cell", { row: 1, column: 1 }), en("board.wall")].join(" ")).toBe("Row 1, column 1. Wall.");
    expect(en("panel.countLabel", { found: 3, total: 6 })).toBe("3 of 6 words found");
    expect(pt("panel.count", { found: 3, total: 6 })).toBe("3 de 6");
    expect(en("panel.rowOpen", { count: 5 })).toBe("Word of 5 letters");
    expect(en("panel.rowHinted", { count: 5, start: "AP" })).toBe("Word of 5 letters, starts with AP");
    expect(pt("panel.rowHinted", { count: 5, start: "MA" })).toBe("Palavra de 5 letras, começa com MA");
    expect(en("panel.rowFound", { word: "APPLE" })).toBe("APPLE, found");
    expect(en("panel.tracing", { letters: "APP" })).toBe("Trail in progress: APP");
  });
});

describe("tutorial", () => {
  const step = (t: typeof en, language: "en" | "pt-br") => {
    const [short, long] = WEND_TUTORIALS[language].puzzle.words;
    return [t("tutorial.steps.trace.body", { letter: short.display[0], word: short.display }), t("tutorial.steps.turn.body", { count: long.text.length, letter: long.display[0] })];
  };

  it("names the words and the letters of the board it teaches on", () => {
    expect(step(en, "en")).toEqual([
      "Drag your finger through neighbouring letters to form a word. The theme is fruit: start on the F and trace FIG along the top row.",
      "A word moves sideways, up and down, never diagonally, and goes around the walls. One fruit of 4 letters is left, and it starts on the P.",
    ]);
    expect(step(pt, "pt-br")).toEqual([
      "Arraste o dedo pelas letras vizinhas para formar uma palavra. O tema é frutas: comece pelo U e trace UVA na linha de cima.",
      "Uma palavra anda para os lados, para cima e para baixo, nunca na diagonal, e desvia das paredes. Falta uma fruta de 4 letras, que começa no F.",
    ]);
  });

  it("reads well with the interface in one language and the board in the other", () => {
    expect(step(en, "pt-br")[0]).toContain("start on the U and trace UVA along the top row");
    expect(step(en, "pt-br")[1]).toContain("it starts on the F");
    expect(step(pt, "en")[0]).toContain("comece pelo F e trace FIG na linha de cima");
    expect(step(pt, "en")[1]).toContain("que começa no P");
    expect(WEND_TUTORIALS.en.theme).toBe("Fruits");
    expect(WEND_TUTORIALS["pt-br"].theme).toBe("Frutas");
  });
});

describe("message files", () => {
  it("holds every sentence of the game, and none of them is left in the wrong language", () => {
    const [english, portuguese] = [messagesOf("en", "wend"), messagesOf("pt-br", "wend")];
    expect(messageKeys(english).length).toBeGreaterThanOrEqual(40);
    expect(messageKeys(portuguese).sort()).toEqual(messageKeys(english).sort());
    // The sentences only: no keys, and no names of placeholders, which are English in both files.
    const text = (messages: Record<string, unknown>): string =>
      Object.values(messages)
        .map((value) => (typeof value === "string" ? value.replace(/\{\s*\w+\s*[,}]/g, " ") : text(value as Record<string, unknown>)))
        .join(" ");
    // Portuguese marks that an English sentence cannot have, and English words a Portuguese one cannot.
    expect(text(english)).not.toMatch(/[ãõçáéíóúâêô]/i);
    expect(text(portuguese)).not.toMatch(/\b(the|and|words?|letters?|trails?|board|found)\b/i);
    // British spelling in the interface too.
    expect(text(english)).toContain("neighbouring");
    expect(text(english)).toContain("grey");
    expect(text(english)).toContain("colour");
  });
});
