import type { Rng } from "@/shared/engine/prng";
import { makeWall, wallKey } from "../grid";
import type { Wall } from "../types";

/**
 * Figures made of walls or of blocked cells. Instead of scattering walls wherever they happen to remove a
 * wrong solution, a themed board starts from a drawing made of walls and grows
 * its path around it. Every figure leaves enough openings for a Hamiltonian
 * path to exist. A closed block with a single doorway, for example, can never
 * be part of one, because the path would enter and could not leave.
 *
 * Blocked cells have a rule of their own. The grid is a checkerboard and a path
 * alternates colours, so the cells left to cover must split evenly between the
 * two colours, give or take one. A domino always takes one of each. Single
 * cells have to be picked by colour.
 */
export const WALL_FIGURES = ["cross", "frame", "corners", "corridors", "slash", "face", "pinwheel", "mirror"] as const;
export const BLOCK_FIGURES = ["core", "pillars", "islands"] as const;
export const FIGURES = ["none", ...WALL_FIGURES, ...BLOCK_FIGURES] as const;
export type FigureName = (typeof FIGURES)[number];

/** How a figure maps onto itself. Extra walls are added together with their twin, so the board keeps looking designed. */
export type Symmetry = "none" | "mirror-x" | "mirror-y" | "rotate";

export type Figure = { name: FigureName; symmetry: Symmetry; walls: Wall[]; blocked: number[] };

type Cell = readonly [row: number, column: number];
type Edge = readonly [Cell, Cell];

/** Wall on the right side of (row, column). */
const right = (row: number, column: number): Edge => [[row, column], [row, column + 1]];
/** Wall under (row, column). */
const under = (row: number, column: number): Edge => [[row, column], [row + 1, column]];
const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

type Drawing = { symmetry: Symmetry; edges: Edge[]; cells?: Cell[] };

function draw(name: Exclude<FigureName, "none">, size: number, rng: Rng): Drawing | null {
  const last = size - 1;
  const half = size / 2;

  switch (name) {
    case "cross": {
      // Four arms that stop short of the centre and of the border. Needs a centre line, so even sizes only.
      if (size % 2 !== 0) return null;
      const arm = range(1, size - 2).filter((index) => index !== half - 1 && index !== half);
      return { symmetry: "rotate", edges: [...arm.map((row) => right(row, half - 1)), ...arm.map((column) => under(half - 1, column))] };
    }
    case "frame": {
      // A dashed square. Dashes keep the ring between frame and border from becoming one long forced corridor.
      // On odd sizes the dashes start one cell later, which leaves the corners of the frame open. With closed
      // corners an odd board has no Hamiltonian path around the frame.
      const inset = size >= 7 && rng.chance(0.5) ? 2 : 1;
      const phase = size % 2 === 0 ? 0 : 1;
      const side = range(inset, last - inset).filter((index) => (index - inset) % 2 === phase);
      return {
        symmetry: "rotate",
        edges: [
          ...side.map((column) => under(inset - 1, column)),
          ...side.map((column) => under(last - inset, last - column)),
          ...side.map((row) => right(row, inset - 1)),
          ...side.map((row) => right(last - row, last - inset)),
        ],
      };
    }
    case "corners": {
      // An L set one cell in from every corner. The border cells behind it become a short corridor around the
      // corner. The arms must leave at least two open cells in the middle of each side. If the four Ls meet, the
      // whole border turns into a closed ring that the path can never leave.
      if (size < 6) return null;
      const reach = size >= 8 ? 2 : 1;
      const edges: Edge[] = [];
      for (const index of range(1, reach)) {
        edges.push(under(0, index), right(index, 0));
        edges.push(under(0, last - index), right(index, last - 1));
        edges.push(under(last - 1, index), right(last - index, 0));
        edges.push(under(last - 1, last - index), right(last - index, last - 1));
      }
      return { symmetry: "rotate", edges };
    }
    case "corridors": {
      // Bars that leave a gap alternately at the top and at the bottom: a meander of two-cell-wide lanes.
      const edges: Edge[] = [];
      range(1, Math.floor((size - 1) / 2)).forEach((bar, order) => {
        const column = bar * 2 - 1;
        const rows = order % 2 === 0 ? range(0, last - 2) : range(2, last);
        edges.push(...rows.map((row) => right(row, column)));
      });
      return { symmetry: "none", edges };
    }
    case "slash": {
      // A dotted diagonal: one tick per second row, with its half-turn twin. Isolated ticks never take a cell
      // down to two exits. A connected staircase does, and the chain of forced turns it creates along the
      // diagonal left no Hamiltonian path on most sizes, so the staircase was dropped for this figure.
      const ticks = range(1, size - 2).filter((index) => index % 2 === 1);
      return { symmetry: "rotate", edges: ticks.flatMap((index) => [right(index, index), right(last - index, last - index - 1)]) };
    }
    case "face": {
      // Two eyes and a smile with upturned corners.
      if (size < 6) return null;
      const mouthRow = size - 3;
      const eyes = [1, 2].flatMap((row) => [right(row, 1), right(row, size - 3)]);
      const smile = range(2, size - 3).map((column) => under(mouthRow, column));
      return { symmetry: "mirror-x", edges: [...eyes, ...smile, right(mouthRow, 1), right(mouthRow, size - 3)] };
    }
    case "pinwheel": {
      // One bar reaching in from the left edge, repeated at every quarter turn.
      // Short blades on small boards. Long ones meet in the middle and close off the centre.
      const row = Math.max(1, Math.floor(size / 3) - 1);
      const blade = range(0, Math.floor(size / 2) - (size < 7 ? 2 : 1)).map((column) => under(row, column));
      const turn = ([r, c]: Cell): Cell => [c, last - r];
      const edges: Edge[] = [];
      let current = blade;
      for (let quarter = 0; quarter < 4; quarter++) {
        edges.push(...current);
        current = current.map(([a, b]) => [turn(a), turn(b)] as const);
      }
      return { symmetry: "rotate", edges };
    }
    case "mirror": {
      // A handful of random walls in the left half, each with its reflection. Symmetry alone makes them look deliberate.
      const edges: Edge[] = [];
      const count = Math.max(2, Math.round(size * 0.45));
      for (let i = 0; i < count; i++) {
        const row = rng.int(size);
        const column = rng.int(Math.max(1, Math.floor(half) - 1));
        const edge = rng.chance(0.5) && row < last ? under(row, column) : right(row, column);
        const [[ar, ac], [br, bc]] = edge;
        edges.push(edge, [[ar, last - ac], [br, last - bc]]);
      }
      return { symmetry: "mirror-x", edges };
    }
    case "core": {
      // The middle of the board is missing: a 2x2 block on even sizes, the centre cell on odd ones. The centre
      // of an odd board has the majority colour, so taking it out leaves the two colours level.
      if (size % 2 === 1) return { symmetry: "rotate", edges: [], cells: [[(size - 1) / 2, (size - 1) / 2]] };
      return { symmetry: "mirror-x", edges: [], cells: [[half - 1, half - 1], [half - 1, half], [half, half - 1], [half, half]] };
    }
    case "pillars": {
      // Single blocked cells, placed symmetrically. On an even size the four images of a cell are two of each
      // colour. On an odd size they would all share one colour, so there it is a cell of the majority colour
      // and its half turn: two cells, which leaves the minority one ahead, and that is still fine.
      if (size % 2 === 0) {
        if (size < 6) return null;
        const spots = range(1, half - 1).flatMap((row) => range(1, half - 1).map((column): Cell => [row, column])).filter(([row, column]) => row !== half - 1 || column !== half - 1);
        const [row, column] = rng.pick(spots);
        return { symmetry: "mirror-x", edges: [], cells: [[row, column], [row, last - column], [last - row, column], [last - row, last - column]] };
      }
      const centre = (size - 1) / 2;
      const spots = range(1, last - 1).flatMap((row) => range(1, last - 1).map((column): Cell => [row, column])).filter(([row, column]) => (row + column) % 2 === 0 && (row !== centre || column !== centre) && row <= centre);
      const [row, column] = rng.pick(spots);
      return { symmetry: "rotate", edges: [], cells: [[row, column], [last - row, last - column]] };
    }
    case "islands": {
      // Dominoes, each with its image: a mirror image on even sizes, a half turn on odd ones. One pair of
      // dominoes on small boards, up to two pairs from 7x7 on. Kept off the border, where a domino would wall in
      // the cells behind it.
      if (size < 6) return null;
      const pairs = size >= 7 && rng.chance(0.5) ? 2 : 1;
      const taken = new Set<string>();
      const cells: Cell[] = [];
      for (let pair = 0, tries = 0; pair < pairs && tries < 24; tries++) {
        const upright = rng.chance(0.5);
        const row = 1 + rng.int(size - (upright ? 3 : 2));
        const column = 1 + rng.int(size - (upright ? 2 : 3));
        const domino: Cell[] = [[row, column], upright ? [row + 1, column] : [row, column + 1]];
        const twin = domino.map(([r, c]): Cell => (size % 2 === 0 ? [r, last - c] : [last - r, last - c]));
        const all = [...domino, ...twin];
        // The images must not overlap or touch each other or an earlier island, centre included.
        const near = (a: Cell, b: Cell): boolean => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 1;
        const centre = (size - 1) / 2;
        if (domino.some((a) => twin.some((b) => near(a, b))) || all.some((a) => cells.some((b) => near(a, b))) || all.some(([r, c]) => r === centre && c === centre)) continue;
        if (all.some(([r, c]) => taken.has(`${r},${c}`))) continue;
        all.forEach(([r, c]) => taken.add(`${r},${c}`));
        cells.push(...all);
        pair++;
      }
      return cells.length === 0 ? null : { symmetry: size % 2 === 0 ? "mirror-x" : "rotate", edges: [], cells };
    }
  }
}

const inside = (size: number, [row, column]: Cell): boolean => row >= 0 && column >= 0 && row < size && column < size;

/** Builds a figure, turned a random way, as walls between cell indices. Returns the empty figure when it does not fit the size. */
export function buildFigure(name: FigureName, size: number, rng: Rng): Figure {
  const drawn = name === "none" ? null : draw(name, size, rng);
  if (!drawn) return { name: "none", symmetry: "none", walls: [], blocked: [] };

  const [transpose, flipRows, flipColumns] = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)];
  const move = ([row, column]: Cell): Cell => {
    let [r, c] = transpose ? [column, row] : [row, column];
    if (flipRows) r = size - 1 - r;
    if (flipColumns) c = size - 1 - c;
    return [r, c];
  };
  const seen = new Set<string>();
  const walls: Wall[] = [];
  for (const [a, b] of drawn.edges) {
    const [from, to] = [move(a), move(b)];
    if (!inside(size, from) || !inside(size, to)) continue;
    const wall = makeWall(from[0] * size + from[1], to[0] * size + to[1]);
    const key = wallKey(wall.a, wall.b);
    if (!seen.has(key)) {
      seen.add(key);
      walls.push(wall);
    }
  }
  const blocked = [...new Set((drawn.cells ?? []).map(move).filter((cell) => inside(size, cell)).map(([row, column]) => row * size + column))].sort((a, b) => a - b);
  // Transposing swaps the mirror axis. Flips and the half turn are unaffected.
  const symmetry: Symmetry = transpose && drawn.symmetry === "mirror-x" ? "mirror-y" : drawn.symmetry;
  return { name, symmetry, walls, blocked };
}

/** The wall a symmetry maps `wall` onto, or null when there is no symmetry or the wall is its own twin. */
export function twinWall(symmetry: Symmetry, size: number, wall: Wall): Wall | null {
  if (symmetry === "none") return null;
  const last = size - 1;
  const map = (cell: number): number => {
    const [row, column] = [Math.floor(cell / size), cell % size];
    if (symmetry === "mirror-x") return row * size + (last - column);
    if (symmetry === "mirror-y") return (last - row) * size + column;
    return (last - row) * size + (last - column);
  };
  const twin = makeWall(map(wall.a), map(wall.b));
  return twin.a === wall.a && twin.b === wall.b ? null : twin;
}
