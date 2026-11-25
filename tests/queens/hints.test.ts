import { describe, expect, it } from "vitest";
import { REGION_COLORS } from "@/games/queens/components/board/palette";
import { EMPTY, type HintReason, MARK, QUEEN, type QueensHint, type UnitRef, buildTopology, generateQueensPuzzle, getQueensHint, hintText, queensOf, ruledOutCells, solveQueens } from "@/games/queens/engine";
import { translator } from "../i18n";
import { CONFINED_LINE, CONFINED_REGION, REGION_GROUP } from "./fixtures";

const puzzle = generateQueensPuzzle("hints", "hard", { size: 8 });
const topology = buildTopology(puzzle);
const empty = () => new Array<number>(64).fill(EMPTY);

/** The English sentences, as a player with the interface in English reads them. */
const t = translator("queens");
const pt = translator("queens", "pt-br");
/** Region 0 is rose, region 1 is sky and so on, the way the board names a region by its colour. */
const colorsIn = (translate: typeof t) => (region: number) => translate(`color.${REGION_COLORS[region].name}`);
const english = colorsIn(t);
const portuguese = colorsIn(pt);
/** A hint with this reason. The sentence only depends on the reason. */
const because = (reason: HintReason): QueensHint => ({ kind: "eliminate", cells: [], highlight: [], technique: "trial", reason });
const row = (index: number) => ({ kind: "row", index }) as const;
const column = (index: number) => ({ kind: "column", index }) as const;
const region = (index: number) => ({ kind: "region", index }) as const;

describe("queens hints", () => {
  it("takes a wrong queen off before anything else", () => {
    const marks = empty();
    const wrong = marks.findIndex((_, cell) => !puzzle.solution.includes(cell));
    marks[wrong] = QUEEN;
    marks[puzzle.solution[7]] = MARK;
    const hint = getQueensHint(topology, puzzle.solution, marks);
    expect(hint).toEqual({ kind: "wrong-queen", cell: wrong });
    expect(hintText(t, hint)).toBe("This queen is in the wrong place. With it there the board cannot be finished, so it comes off.");
    expect(hintText(pt, hint)).toBe("Esta rainha está no lugar errado. Com ela ali não dá para terminar o tabuleiro, então ela sai.");
  });

  it("takes off an X that covers a solution cell", () => {
    const marks = empty();
    marks[puzzle.solution[3]] = MARK;
    const hint = getQueensHint(topology, puzzle.solution, marks);
    expect(hint).toEqual({ kind: "wrong-mark", cell: puzzle.solution[3] });
    expect(hintText(t, hint)).toBe("This X is on a cell that needs a queen, so it comes off.");
    expect(hintText(pt, hint)).toBe("Este X está em uma casa que precisa de uma rainha, então ele sai.");
  });

  it("says so when the board is complete", () => {
    const marks = empty();
    for (const cell of puzzle.solution) marks[cell] = QUEEN;
    expect(getQueensHint(topology, puzzle.solution, marks).kind).toBe("complete");
  });

  it("returns the reason as data, and the text names a region by its number or by its colour", () => {
    const board = buildTopology(CONFINED_REGION);
    const solution = [0, 0, 0, 0, 0]; // not consulted: the board is empty, so there is no mistake to find
    const hint = getQueensHint(board, solution, new Array<number>(25).fill(EMPTY));
    expect(hint).toMatchObject({ kind: "eliminate", technique: "confined-region", cells: [3, 4], reason: { code: "confined-region", region: 0, line: { kind: "row", index: 0 } } });
    if (hint.kind === "eliminate") expect(hint.highlight).toEqual([0, 1, 2]);
    expect(hintText(t, hint)).toBe("Every free cell of region 1 is in row 1, so its queen takes that row. No other cell there can hold one.");
    expect(hintText(t, hint, english)).toBe("Every free cell of the rose region is in row 1, so its queen takes that row. No other cell there can hold one.");
    expect(hintText(pt, hint)).toBe("Todas as casas livres da região 1 estão na linha 1, então a rainha dela fica nessa linha. Nenhuma outra casa dali pode ter uma rainha.");
    expect(hintText(pt, hint, portuguese)).toBe("Todas as casas livres da região rosa estão na linha 1, então a rainha dela fica nessa linha. Nenhuma outra casa dali pode ter uma rainha.");

    const line = getQueensHint(buildTopology(CONFINED_LINE), solution, new Array<number>(25).fill(EMPTY));
    expect(line).toMatchObject({ kind: "eliminate", technique: "confined-line", reason: { code: "confined-line", region: 0, line: { kind: "column", index: 0 } } });
    expect(hintText(t, line)).toBe("Every free cell of column 1 is in region 1, so that region's queen is there. Its other cells are out.");
    expect(hintText(pt, line, portuguese)).toBe("Todas as casas livres da coluna 1 estão na região rosa, então a rainha dessa região fica ali. As outras casas dela estão eliminadas.");
  });

  it("names the regions and the lines of a group step, however many there are", () => {
    const board = buildTopology(REGION_GROUP);
    const solution = solveQueens(REGION_GROUP).solutions[0];
    const marks = new Array<number>(25).fill(EMPTY);
    let hint = getQueensHint(board, solution, marks);
    for (let guard = 0; guard < 30 && !(hint.kind === "eliminate" && hint.technique === "region-group"); guard++) {
      if (hint.kind === "place") marks[hint.cell] = QUEEN;
      else if (hint.kind === "eliminate") for (const cell of hint.cells) marks[cell] = MARK;
      else throw new Error(`unexpected ${hint.kind}`);
      hint = getQueensHint(board, solution, marks);
    }
    expect(hint).toMatchObject({ kind: "eliminate", technique: "region-group", reason: { code: "region-group", regions: [0, 1], lines: [row(0), row(1)] } });
    expect(hintText(t, hint)).toBe("Region 1 and region 2 have all their free cells in rows 1 and 2. They take every queen there, so no other region can use those rows.");
    expect(hintText(t, hint, english)).toBe("The rose region and the sky region have all their free cells in rows 1 and 2. They take every queen there, so no other region can use those rows.");
    expect(hintText(pt, hint)).toBe("As regiões 1 e 2 têm todas as casas livres nas linhas 1 e 2. Elas ficam com todas as rainhas dali, então nenhuma outra região pode usar essas linhas.");
    expect(hintText(pt, hint, portuguese)).toBe("As regiões rosa e azul-celeste têm todas as casas livres nas linhas 1 e 2. Elas ficam com todas as rainhas dali, então nenhuma outra região pode usar essas linhas.");

    const three = because({ code: "region-group", regions: [0, 1, 2], lines: [column(0), column(3), column(4)] });
    expect(hintText(t, three, english)).toBe("The rose region, the sky region and the butter region have all their free cells in columns 1, 4 and 5. They take every queen there, so no other region can use those columns.");
    expect(hintText(pt, three, portuguese)).toBe("As regiões rosa, azul-celeste e amarela têm todas as casas livres nas colunas 1, 4 e 5. Elas ficam com todas as rainhas dali, então nenhuma outra região pode usar essas colunas.");

    const lines = because({ code: "line-group", regions: [0, 1], lines: [row(0), row(1)] });
    expect(hintText(t, lines, english)).toBe("Rows 1 and 2 only have free cells in the rose region and the sky region. Those regions place their queens there, so their cells elsewhere are out.");
    expect(hintText(pt, lines, portuguese)).toBe("As linhas 1 e 2 só têm casas livres nas regiões rosa e azul-celeste. Essas regiões colocam suas rainhas ali, então as outras casas delas estão eliminadas.");
    const columns = because({ code: "line-group", regions: [0, 1, 3], lines: [column(1), column(2), column(4)] });
    expect(hintText(t, columns)).toBe("Columns 2, 3 and 5 only have free cells in region 1, region 2 and region 4. Those regions place their queens there, so their cells elsewhere are out.");
    expect(hintText(pt, columns)).toBe("As colunas 2, 3 e 5 só têm casas livres nas regiões 1, 2 e 4. Essas regiões colocam suas rainhas ali, então as outras casas delas estão eliminadas.");
  });

  it("phrases a step about one group for a row, a column and a region, in both languages", () => {
    const single = (unit: UnitRef) => because({ code: "single", unit });
    expect(hintText(t, single(row(2)))).toBe("Row 3 has one free cell left, so its queen goes there.");
    expect(hintText(t, single(column(1)))).toBe("Column 2 has one free cell left, so its queen goes there.");
    expect(hintText(t, single(region(0)))).toBe("Region 1 has one free cell left, so its queen goes there.");
    expect(hintText(t, single(region(0)), english)).toBe("The rose region has one free cell left, so its queen goes there.");
    expect(hintText(pt, single(row(2)))).toBe("Só resta uma casa livre na linha 3, então a rainha dela vai ali.");
    expect(hintText(pt, single(column(1)))).toBe("Só resta uma casa livre na coluna 2, então a rainha dela vai ali.");
    expect(hintText(pt, single(region(0)))).toBe("Só resta uma casa livre na região 1, então a rainha dela vai ali.");
    expect(hintText(pt, single(region(0)), portuguese)).toBe("Só resta uma casa livre na região rosa, então a rainha dela vai ali.");

    // One cell or several: the sentence agrees in number.
    expect(hintText(t, because({ code: "blocker", unit: row(3), cells: 1 }))).toBe("A queen on this cell would rule out every free cell of row 4.");
    expect(hintText(t, because({ code: "blocker", unit: region(1), cells: 2 }), english)).toBe("A queen on any of these cells would rule out every free cell of the sky region.");
    expect(hintText(pt, because({ code: "blocker", unit: row(3), cells: 1 }))).toBe("Uma rainha nesta casa eliminaria todas as casas livres da linha 4.");
    expect(hintText(pt, because({ code: "blocker", unit: column(0), cells: 3 }))).toBe("Uma rainha em qualquer uma destas casas eliminaria todas as casas livres da coluna 1.");
    expect(hintText(pt, because({ code: "blocker", unit: region(1), cells: 2 }), portuguese)).toBe("Uma rainha em qualquer uma destas casas eliminaria todas as casas livres da região azul-celeste.");

    expect(hintText(t, because({ code: "trial", unit: column(4) }))).toBe("A queen on this cell forces other queens one after another, and column 5 ends up with no free cell.");
    expect(hintText(t, because({ code: "trial", unit: region(2) }), english)).toBe("A queen on this cell forces other queens one after another, and the butter region ends up with no free cell.");
    expect(hintText(pt, because({ code: "trial", unit: column(4) }))).toBe("Uma rainha nesta casa força outras rainhas, uma depois da outra, e a coluna 5 acaba sem nenhuma casa livre.");
    expect(hintText(pt, because({ code: "trial", unit: region(2) }), portuguese)).toBe("Uma rainha nesta casa força outras rainhas, uma depois da outra, e a região amarela acaba sem nenhuma casa livre.");

    expect(hintText(t, because({ code: "solution", region: 0 }), english)).toBe("The queen of the rose region goes here.");
    expect(hintText(t, because({ code: "solution", region: 4 }))).toBe("The queen of region 5 goes here.");
    expect(hintText(pt, because({ code: "solution", region: 0 }), portuguese)).toBe("A rainha da região rosa vai aqui.");
  });

  it("solves any board when followed to the end, without a single guess", () => {
    for (const difficulty of ["easy", "medium", "hard", "expert"] as const) {
      for (let i = 0; i < 6; i++) {
        const board = generateQueensPuzzle(`follow-${i}`, difficulty);
        const boardTopology = buildTopology(board);
        const solution = new Set(board.solution);
        const marks = new Array<number>(board.size * board.size).fill(EMPTY);
        let steps = 0;
        for (; steps < 400; steps++) {
          const hint = getQueensHint(boardTopology, board.solution, marks);
          if (hint.kind === "complete") break;
          // Every step a real board produces has a sentence in both languages. A missing key or value would throw.
          expect(hintText(t, hint, english).length).toBeGreaterThan(10);
          expect(hintText(pt, hint, portuguese).length).toBeGreaterThan(10);
          if (hint.kind === "place") {
            expect(solution.has(hint.cell), `${board.seed} step ${steps}`).toBe(true);
            expect(hint.technique).toBe("single");
            marks[hint.cell] = QUEEN;
          } else if (hint.kind === "eliminate") {
            expect(hint.cells.length).toBeGreaterThan(0);
            const ruledOut = ruledOutCells(boardTopology, queensOf(marks));
            for (const cell of hint.cells) {
              expect(solution.has(cell), `${board.seed} step ${steps}`).toBe(false);
              // A hint never repeats what the board already shows.
              expect(marks[cell]).toBe(EMPTY);
              expect(ruledOut.has(cell)).toBe(false);
              marks[cell] = MARK;
            }
          } else {
            throw new Error(`unexpected ${hint.kind} on a board without mistakes`);
          }
        }
        expect(queensOf(marks)).toEqual(board.solution);
        expect(steps).toBe(board.metadata.steps);
      }
    }
  });

  it("uses what the player already worked out", () => {
    const marks = empty();
    for (const cell of puzzle.solution.slice(0, 7)) marks[cell] = QUEEN;
    const hint = getQueensHint(topology, puzzle.solution, marks);
    expect(hint).toMatchObject({ kind: "place", cell: puzzle.solution[7], technique: "single" });
  });
});
