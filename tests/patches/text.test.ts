import { describe, expect, it } from "vitest";
import { type Clue, type Hint, type RegionErrorCode, clueText, getHint, hintText, regionErrorText, regionFromRect, validateRegion } from "@/games/patches/engine";
import { translator } from "../i18n";
import { QUADRANT_RECTS, REAL_188, quadrants } from "./fixtures";

/** The sentences as a player reads them, in English and in Portuguese. */
const t = translator("patches");
const pt = translator("patches", "pt-br");

const clue = (rule: Pick<Clue, "area" | "shape">): Clue => ({ id: "x", row: 0, column: 0, ...rule });

describe("clue descriptions", () => {
  it("names the shape first when the clue has a shape rule", () => {
    expect(clueText(t, clue({ area: 6, shape: "wide" }))).toBe("a wide rectangle of 6 cells");
    expect(clueText(t, clue({ area: 6, shape: "tall" }))).toBe("a tall rectangle of 6 cells");
    expect(clueText(t, clue({ area: 9, shape: "square" }))).toBe("a square of 9 cells");
    expect(clueText(t, clue({ area: 1, shape: "square" }))).toBe("a square of 1 cell");
    expect(clueText(t, clue({ shape: "tall" }))).toBe("a tall rectangle of unknown size");
  });

  it("names the number first when any rectangle will do", () => {
    expect(clueText(t, clue({ area: 4 }))).toBe("4 cells, any rectangle");
    expect(clueText(t, clue({ area: 1 }))).toBe("1 cell, any rectangle");
    expect(clueText(t, clue({ area: 4, shape: "freeform" }))).toBe("4 cells, any rectangle");
    expect(clueText(t, clue({ shape: "freeform" }))).toBe("unknown size, any rectangle");
    expect(clueText(t, clue({}))).toBe("unknown size, any rectangle");
  });

  it("says the same in Portuguese", () => {
    expect(clueText(pt, clue({ area: 6, shape: "wide" }))).toBe("um retângulo largo de 6 casas");
    expect(clueText(pt, clue({ area: 1, shape: "square" }))).toBe("um quadrado de 1 casa");
    expect(clueText(pt, clue({ shape: "tall" }))).toBe("um retângulo alto sem número");
    expect(clueText(pt, clue({ area: 4 }))).toBe("4 casas, qualquer retângulo");
    expect(clueText(pt, clue({}))).toBe("sem número, qualquer retângulo");
  });
});

describe("refused rectangles", () => {
  const puzzle = quadrants();
  const errorsOf = (rect: Parameters<typeof regionFromRect>[2], clueId: string, placed: ReturnType<typeof regionFromRect>[] = []) =>
    validateRegion(puzzle, placed, regionFromRect(`region-${clueId}`, clueId, rect)).errors;

  it("come back as a code and the values of the sentence, never as a sentence", () => {
    expect(errorsOf({ row: 0, column: 0, width: 3, height: 3 }, "a")).toEqual([{ code: "wrong-area", values: { needed: 4, area: 9 } }]);
    expect(errorsOf({ row: 0, column: 0, width: 1, height: 2 }, "a")).toEqual([
      { code: "wrong-area", values: { needed: 4, area: 2 } },
      { code: "wrong-shape", values: { shape: "square", width: 1, height: 2 } },
    ]);
    expect(errorsOf({ row: 1, column: 1, width: 2, height: 2 }, "")).toEqual([{ code: "no-clue" }]);
    expect(errorsOf({ row: 0, column: 0, width: 4, height: 1 }, "a")).toContainEqual({ code: "multiple-clues", values: { count: 2 } });
  });

  it("read in English as they always did", () => {
    const [area, shape] = errorsOf({ row: 0, column: 0, width: 1, height: 2 }, "a");
    expect(regionErrorText(t, area)).toBe("This clue needs 4 cells. The patch has 2.");
    expect(regionErrorText(t, shape)).toBe("This clue needs a square. The patch is 1 by 2.");
    expect(regionErrorText(t, { code: "wrong-shape", values: { shape: "tall", width: 3, height: 2 } })).toBe("This clue needs a tall rectangle. The patch is 3 by 2.");
    expect(regionErrorText(t, { code: "wrong-shape", values: { shape: "wide", width: 2, height: 3 } })).toBe("This clue needs a wide rectangle. The patch is 2 by 3.");
    expect(regionErrorText(t, { code: "wrong-area", values: { needed: 1, area: 2 } })).toBe("This clue needs 1 cell. The patch has 2.");
    expect(regionErrorText(t, { code: "multiple-clues", values: { count: 2 } })).toBe("A patch can hold only one clue. This one holds 2.");
    expect(regionErrorText(t, { code: "no-clue" })).toBe("A patch must contain a clue.");
    expect(regionErrorText(t, { code: "empty" })).toBe("The patch has no cells.");
    expect(regionErrorText(t, { code: "out-of-bounds" })).toBe("The patch leaves the board.");
    expect(regionErrorText(t, { code: "not-rectangle" })).toBe("A patch must be a filled rectangle.");
    expect(regionErrorText(t, { code: "clue-mismatch" })).toBe("The patch is linked to a clue it does not contain.");
    const placed = [regionFromRect("region-a", "a", QUADRANT_RECTS.a)];
    const overlap = errorsOf({ row: 0, column: 1, width: 3, height: 2 }, "b", placed).find((error) => error.code === "overlap")!;
    expect(regionErrorText(t, overlap)).toBe("The patch overlaps another patch.");
  });

  it("read in Portuguese on a Portuguese page", () => {
    const [area, shape] = errorsOf({ row: 0, column: 0, width: 1, height: 2 }, "a");
    expect(regionErrorText(pt, area)).toBe("Esta pista pede 4 casas. O retalho tem 2.");
    expect(regionErrorText(pt, shape)).toBe("Esta pista pede um quadrado. O retalho tem 1 por 2.");
    expect(regionErrorText(pt, { code: "wrong-area", values: { needed: 1, area: 2 } })).toBe("Esta pista pede 1 casa. O retalho tem 2.");
    expect(regionErrorText(pt, { code: "multiple-clues", values: { count: 3 } })).toBe("Um retalho só pode ter uma pista. Este tem 3.");
    expect(regionErrorText(pt, { code: "overlap" })).toBe("O retalho se sobrepõe a outro retalho.");
  });

  it("have a sentence for every code, in both languages", () => {
    const codes: RegionErrorCode[] = ["empty", "out-of-bounds", "not-rectangle", "no-clue", "multiple-clues", "clue-mismatch", "wrong-area", "wrong-shape", "overlap"];
    const values = { count: 2, needed: 4, area: 9, shape: "tall", width: 1, height: 2 };
    for (const code of codes) {
      // The test translator throws on a key that does not exist.
      expect(regionErrorText(t, { code, values }).length, code).toBeGreaterThan(10);
      expect(regionErrorText(pt, { code, values }), code).not.toBe(regionErrorText(t, { code, values }));
    }
  });
});

describe("hint explanations", () => {
  const place: Omit<Extract<Hint, { kind: "place-region" }>, "technique"> = {
    kind: "place-region",
    clueId: "x",
    clue: clue({ area: 6, shape: "tall" }),
    rect: { row: 0, column: 0, width: 2, height: 3 },
    cells: [],
    neededElimination: false,
  };

  it("explain each technique in English as they always did", () => {
    expect(hintText(t, { ...place, technique: "clue-single" })).toBe("Only one rectangle fits this clue (a tall rectangle of 6 cells) in the space that is left. Draw the 2 by 3 patch.");
    expect(hintText(t, { ...place, technique: "clue-single", neededElimination: true })).toBe(
      "This clue (a tall rectangle of 6 cells) has one option left. Every other rectangle would leave a cell that no clue can reach. Draw the 2 by 3 patch.",
    );
    expect(hintText(t, { ...place, technique: "cell-single", focusCell: { row: 2, column: 1 } })).toBe(
      "The cell in row 3, column 2 can only be reached from this clue (a tall rectangle of 6 cells), and only by this 2 by 3 patch.",
    );
    expect(hintText(t, { ...place, technique: "search" })).toBe(
      "No single-step deduction is available, so this one comes from the solver: the clue (a tall rectangle of 6 cells) takes a 2 by 3 patch here.",
    );
  });

  it("explain a patch that has to go, and a finished board", () => {
    const wrong: Omit<Extract<Hint, { kind: "wrong-region" }>, "reason"> = { kind: "wrong-region", regionId: "region-x", clueId: "x", cells: [] };
    expect(hintText(t, { ...wrong, reason: "astray" })).toBe("This unfinished patch reaches cells that belong to another clue, so it cannot grow into the right one. It comes off.");
    expect(hintText(t, { ...wrong, reason: "unsolvable" })).toBe("This patch follows its clue, but the rest of the board cannot be completed around it. Tap it to remove it.");
    expect(hintText(t, { kind: "complete" })).toBe("The board is complete.");
  });

  it("explain in Portuguese on a Portuguese page", () => {
    expect(hintText(pt, { ...place, technique: "clue-single" })).toBe("Só um retângulo serve para esta pista (um retângulo alto de 6 casas) no espaço que sobrou. Desenhe o retalho de 2 por 3.");
    expect(hintText(pt, { ...place, technique: "cell-single", focusCell: { row: 2, column: 1 } })).toBe(
      "A casa da linha 3, coluna 2 só é alcançada por esta pista (um retângulo alto de 6 casas), e só com este retalho de 2 por 3.",
    );
    expect(hintText(pt, { ...place, technique: "clue-single", neededElimination: true })).toBe(
      "Esta pista (um retângulo alto de 6 casas) só tem uma opção. As outras deixariam uma casa que nenhuma pista alcança. Desenhe o retalho de 2 por 3.",
    );
    expect(hintText(pt, { ...place, technique: "search" })).toBe(
      "Não há dedução de um passo só, então esta vem direto da solução: a pista (um retângulo alto de 6 casas) recebe aqui um retalho de 2 por 3.",
    );
    expect(hintText(pt, { kind: "wrong-region", regionId: "region-x", clueId: "x", cells: [], reason: "unsolvable" })).toBe(
      "Este retalho segue a pista dele, mas não dá para completar o resto do tabuleiro em volta. Toque nele para remover.",
    );
    expect(hintText(pt, { kind: "complete" })).toBe("O tabuleiro está completo.");
  });

  it("describe the clue and the rectangle of a hint the engine really gives", () => {
    const hint = getHint(REAL_188, []);
    expect(hint.kind).toBe("place-region");
    if (hint.kind !== "place-region") return;
    expect(hint.clue).toEqual(REAL_188.clues.find((entry) => entry.id === hint.clueId));
    for (const [translate, by] of [[t, "by"], [pt, "por"]] as const) {
      const text = hintText(translate, hint);
      expect(text).toContain(`(${clueText(translate, hint.clue)})`);
      expect(text).toContain(`${hint.rect.width} ${by} ${hint.rect.height}`);
    }
  });

  it("have a sentence for every kind of hint, in both languages", () => {
    const hints: Hint[] = [
      { ...place, technique: "clue-single" },
      { ...place, technique: "clue-single", neededElimination: true },
      { ...place, technique: "cell-single", focusCell: { row: 0, column: 0 } },
      { ...place, technique: "search" },
      { kind: "wrong-region", regionId: "r", clueId: "x", cells: [], reason: "astray" },
      { kind: "wrong-region", regionId: "r", clueId: "x", cells: [], reason: "unsolvable" },
      { kind: "complete" },
    ];
    for (const hint of hints) expect(hintText(pt, hint)).not.toBe(hintText(t, hint));
  });
});

describe("status lines", () => {
  it("count patches and cells with the right plural", () => {
    expect(t("idle.progress", { placed: 2, total: 6, unfinished: 0 })).toBe("2 of 6 patches done.");
    expect(t("idle.progress", { placed: 2, total: 6, unfinished: 1 })).toBe("2 of 6 patches done, 1 unfinished.");
    expect(t("idle.progress", { placed: 0, total: 6, unfinished: 3 })).toBe("0 of 6 patches done, 3 unfinished.");
    expect(pt("idle.progress", { placed: 2, total: 6, unfinished: 0 })).toBe("2 de 6 retalhos prontos.");
    expect(pt("idle.progress", { placed: 2, total: 6, unfinished: 1 })).toBe("2 de 6 retalhos prontos, 1 incompleto.");
    expect(pt("idle.progress", { placed: 2, total: 6, unfinished: 2 })).toBe("2 de 6 retalhos prontos, 2 incompletos.");
  });

  it("say what a stroke did", () => {
    expect(t("status.placed", { width: 2, height: 3 })).toBe("Placed a 2 by 3 patch.");
    expect(t("status.finished", { width: 2, height: 3 })).toBe("Patch finished: 2 by 3.");
    expect(t("status.pendingCounted", { area: 2, total: 6 })).toBe("2 of 6 cells. Drag again from the clue or from the patch to add the rest.");
    expect(t("status.pendingOpen", { area: 3 })).toBe("3 cells so far. Drag again from the clue or from the patch to add the rest.");
    expect(t("status.refusedOnPatch", { reason: regionErrorText(t, { code: "overlap" }) })).toBe("The patch overlaps another patch. Tap the patch to take it off and start over.");
    expect(pt("status.placed", { width: 2, height: 3 })).toBe("Retalho de 2 por 3 colocado.");
    expect(pt("status.pendingCounted", { area: 2, total: 6 })).toBe("2 de 6 casas. Arraste de novo a partir da pista ou do retalho para completar.");
    expect(pt("status.pendingOpen", { area: 1 })).toBe("1 casa até agora. Arraste de novo a partir da pista ou do retalho para completar.");
  });
});
