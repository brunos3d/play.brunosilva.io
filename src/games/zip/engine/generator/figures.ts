import type { Rng } from "@/shared/engine/prng";
import { makeWall, wallKey } from "../grid";
import type { Wall } from "../types";

/**
 * Wall figures. Instead of scattering walls wherever they happen to remove a
 * wrong solution, a themed board starts from a drawing made of walls and grows
 * its path around it. Every figure leaves enough openings for a Hamiltonian
 * path to exist. A closed block with a single doorway, for example, can never
 * be part of one, because the path would enter and could not leave.
 */
export const FIGURES = ["none", "cross", "frame", "corners", "corridors", "slash", "face", "pinwheel", "mirror"] as const;
export type FigureName = (typeof FIGURES)[number];

/** How a figure maps onto itself. Extra walls are added together with their twin, so the board keeps looking designed. */
export type Symmetry = "none" | "mirror-x" | "mirror-y" | "rotate";

export type Figure = { name: FigureName; symmetry: Symmetry; walls: Wall[] };

type Cell = readonly [row: number, column: number];
type Edge = readonly [Cell, Cell];

/** Wall on the right side of (row, column). */
const right = (row: number, column: number): Edge => [[row, column], [row, column + 1]];
/** Wall under (row, column). */
const under = (row: number, column: number): Edge => [[row, column], [row + 1, column]];
const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

function draw(name: Exclude<FigureName, "none">, size: number, rng: Rng): { symmetry: Symmetry; edges: Edge[] } | null {
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
  }
}

const inside = (size: number, [row, column]: Cell): boolean => row >= 0 && column >= 0 && row < size && column < size;

/** Builds a figure, turned a random way, as walls between cell indices. Returns the empty figure when it does not fit the size. */
export function buildFigure(name: FigureName, size: number, rng: Rng): Figure {
  const drawn = name === "none" ? null : draw(name, size, rng);
  if (!drawn) return { name: "none", symmetry: "none", walls: [] };

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
  // Transposing swaps the mirror axis. Flips and the half turn are unaffected.
  const symmetry: Symmetry = transpose && drawn.symmetry === "mirror-x" ? "mirror-y" : drawn.symmetry;
  return { name, symmetry, walls };
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
