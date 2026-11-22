import type { QueensShape } from "./types";

export type UnitKind = "region" | "row" | "column";

/** A region, a row or a column: the three kinds of group that hold exactly one queen. */
export type Unit = { kind: UnitKind; index: number; cells: readonly number[] };

/**
 * Everything the rules, the solvers and the board keep asking about a shape,
 * computed once. Cells are row-major indices.
 */
export type Topology = {
  size: number;
  cellCount: number;
  regionOf: readonly number[];
  regionCount: number;
  /** Regions first, then rows, then columns. `units[regionOf[cell]]` is a cell's region. */
  units: readonly Unit[];
  /** Cells a queen on this cell rules out: its row, column, region and eight neighbours. The cell itself is not in the list. */
  attacks: readonly (readonly number[])[];
  /** `attackMap[a * cellCount + b]` is 1 when a queen on `a` rules out `b`. */
  attackMap: Uint8Array;
};

export const rowOf = (size: number, cell: number): number => Math.floor(cell / size);
export const columnOf = (size: number, cell: number): number => cell % size;

export function buildTopology(shape: QueensShape): Topology {
  const { size } = shape;
  const cellCount = size * size;
  const regionOf = shape.regions;
  let regionCount = 0;
  for (const region of regionOf) regionCount = Math.max(regionCount, region + 1);

  const regionCells: number[][] = Array.from({ length: regionCount }, () => []);
  for (let cell = 0; cell < cellCount; cell++) regionCells[regionOf[cell]].push(cell);
  const units: Unit[] = regionCells.map((cells, index) => ({ kind: "region", index, cells }));
  for (let row = 0; row < size; row++) units.push({ kind: "row", index: row, cells: Array.from({ length: size }, (_, column) => row * size + column) });
  for (let column = 0; column < size; column++) units.push({ kind: "column", index: column, cells: Array.from({ length: size }, (_, row) => row * size + column) });

  const attackMap = new Uint8Array(cellCount * cellCount);
  const attacks: number[][] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const row = rowOf(size, cell);
    const column = columnOf(size, cell);
    const list: number[] = [];
    for (let other = 0; other < cellCount; other++) {
      if (other === cell) continue;
      const otherRow = rowOf(size, other);
      const otherColumn = columnOf(size, other);
      const touching = Math.abs(otherRow - row) <= 1 && Math.abs(otherColumn - column) <= 1;
      if (otherRow === row || otherColumn === column || regionOf[other] === regionOf[cell] || touching) {
        list.push(other);
        attackMap[cell * cellCount + other] = 1;
      }
    }
    attacks.push(list);
  }
  return { size, cellCount, regionOf, regionCount, units, attacks, attackMap };
}

/** Units of a cell: its region, its row and its column, as indices into `topology.units`. */
export function unitsOf(topology: Topology, cell: number): [number, number, number] {
  return [topology.regionOf[cell], topology.regionCount + rowOf(topology.size, cell), topology.regionCount + topology.size + columnOf(topology.size, cell)];
}

/** Side neighbours inside the board. */
export function sideNeighbors(size: number, cell: number): number[] {
  const row = rowOf(size, cell);
  const column = columnOf(size, cell);
  const result: number[] = [];
  if (row > 0) result.push(cell - size);
  if (column < size - 1) result.push(cell + 1);
  if (row < size - 1) result.push(cell + size);
  if (column > 0) result.push(cell - 1);
  return result;
}
