import { type Topology, columnOf, rowOf } from "../grid";
import type { Technique } from "../types";

/**
 * Deduction solver. Every step follows from the rules by one of the techniques
 * below, the way a person works through a board. The generator only ships
 * boards this solver finishes, and hints replay its steps.
 *
 * Level 1  single          a region, row or column has one free cell: the queen goes there
 * Level 2  confined-region every free cell of a region is in one line: the rest of the line is out
 *          confined-line   every free cell of a line is in one region: the rest of the region is out
 * Level 3  blocker         a queen here would rule out every free cell of a group with at most 2 free cells
 * Level 4  region-group    2 regions fit inside 2 lines: other regions lose their cells there
 *          line-group      2 lines have free cells in only 2 regions: those regions lose their cells elsewhere
 *          blocker         against a group with 3 or 4 free cells
 * Level 5  the group techniques with 3 or more lines, and a blocker against a larger group
 * Level 6  trial           a queen here forces a chain of singles that leaves some group without a cell
 *
 * "Line" means a row or a column. Placing a queen rules out its row, column,
 * region and eight neighbours at once. That is part of placing, not a step.
 */
export type Knowledge = {
  /** 1 while a queen may still go on the cell. A cell that holds a queen is not free. */
  free: Uint8Array;
  queens: number[];
  /** Per unit of the topology: 1 once it holds a queen. */
  done: Uint8Array;
};

export type DeductionStep = {
  technique: Technique;
  level: number;
  /** The cell that takes a queen, for "single". */
  place: number | null;
  /** Cells the reasoning rules out. */
  eliminate: number[];
  /** Regions (or, for "single" and "blocker", any group) the reason is about, as indices into `topology.units`. */
  units: number[];
  /** Rows or columns the reason is about, as indices into `topology.units`. */
  lines: number[];
};

export const LEVEL_WEIGHTS: readonly number[] = [0, 1, 3, 6, 10, 16];
export const MAX_LEVEL = LEVEL_WEIGHTS.length;

export function createKnowledge(topology: Topology, queens: readonly number[] = [], excluded: readonly number[] = []): Knowledge {
  const knowledge: Knowledge = { free: new Uint8Array(topology.cellCount).fill(1), queens: [], done: new Uint8Array(topology.units.length) };
  for (const cell of excluded) knowledge.free[cell] = 0;
  for (const queen of queens) placeQueen(topology, knowledge, queen);
  return knowledge;
}

/** Puts a queen on the board and rules out everything it attacks. */
export function placeQueen(topology: Topology, knowledge: Knowledge, cell: number): void {
  knowledge.queens.push(cell);
  knowledge.free[cell] = 0;
  for (const other of topology.attacks[cell]) knowledge.free[other] = 0;
  const { size, regionCount, regionOf } = topology;
  knowledge.done[regionOf[cell]] = 1;
  knowledge.done[regionCount + rowOf(size, cell)] = 1;
  knowledge.done[regionCount + size + columnOf(size, cell)] = 1;
}

export function applyStep(topology: Topology, knowledge: Knowledge, step: DeductionStep): void {
  for (const cell of step.eliminate) knowledge.free[cell] = 0;
  if (step.place !== null) placeQueen(topology, knowledge, step.place);
}

type Live = (readonly number[])[];

function liveCells(topology: Topology, knowledge: Knowledge): Live {
  return topology.units.map((unit, index) => (knowledge.done[index] ? [] : unit.cells.filter((cell) => knowledge.free[cell] === 1)));
}

/** True when some group that still needs a queen has no free cell left: the position has no solution. */
export function isContradiction(topology: Topology, knowledge: Knowledge): boolean {
  return topology.units.some((unit, index) => !knowledge.done[index] && unit.cells.every((cell) => knowledge.free[cell] === 0));
}

const lineIndex = (topology: Topology, kind: "row" | "column", cell: number): number => (kind === "row" ? rowOf(topology.size, cell) : columnOf(topology.size, cell));

function findSingle(topology: Topology, knowledge: Knowledge, live: Live): DeductionStep | null {
  for (let unit = 0; unit < live.length; unit++) {
    if (!knowledge.done[unit] && live[unit].length === 1) return { technique: "single", level: 1, place: live[unit][0], eliminate: [], units: [unit], lines: [] };
  }
  return null;
}

function findConfined(topology: Topology, knowledge: Knowledge, live: Live): DeductionStep | null {
  const { size, regionCount, regionOf } = topology;
  for (let region = 0; region < regionCount; region++) {
    if (knowledge.done[region]) continue;
    for (const kind of ["row", "column"] as const) {
      const line = lineIndex(topology, kind, live[region][0]);
      if (!live[region].every((cell) => lineIndex(topology, kind, cell) === line)) continue;
      const unit = regionCount + (kind === "row" ? 0 : size) + line;
      const eliminate = live[unit].filter((cell) => regionOf[cell] !== region);
      if (eliminate.length > 0) return { technique: "confined-region", level: 2, place: null, eliminate, units: [region], lines: [unit] };
    }
  }
  for (let unit = regionCount; unit < live.length; unit++) {
    if (knowledge.done[unit]) continue;
    const region = regionOf[live[unit][0]];
    if (!live[unit].every((cell) => regionOf[cell] === region)) continue;
    const inLine = new Set(live[unit]);
    const eliminate = live[region].filter((cell) => !inLine.has(cell));
    if (eliminate.length > 0) return { technique: "confined-line", level: 2, place: null, eliminate, units: [region], lines: [unit] };
  }
  return null;
}

/** Cells whose queen would rule out every free cell of a group with `minLive` to `maxLive` free cells. */
function findBlocker(topology: Topology, knowledge: Knowledge, live: Live, minLive: number, maxLive: number, level: number): DeductionStep | null {
  const { cellCount, attackMap } = topology;
  for (let unit = 0; unit < live.length; unit++) {
    const target = live[unit];
    if (knowledge.done[unit] || target.length < minLive || target.length > maxLive) continue;
    const eliminate: number[] = [];
    for (let cell = 0; cell < cellCount; cell++) {
      if (knowledge.free[cell] === 0 || target.includes(cell)) continue;
      // A queen on a cell of the group itself fills the group, so only outside cells can starve it.
      if (topology.units[unit].cells.includes(cell)) continue;
      let starves = true;
      for (const other of target) {
        if (attackMap[cell * cellCount + other] === 0) {
          starves = false;
          break;
        }
      }
      if (starves) eliminate.push(cell);
    }
    if (eliminate.length > 0) return { technique: "blocker", level, place: null, eliminate, units: [unit], lines: [] };
  }
  return null;
}

/**
 * Counting argument over sets of rows or of columns. When k regions have all
 * their free cells inside k lines, those regions take every queen of those
 * lines, and the other regions lose their cells there. Seen from the remaining
 * lines it is the same fact: they only have free cells in as many regions as
 * there are lines. The step is reported from whichever side is smaller.
 * `wanted` picks the group sizes to look for, so pairs are tried before larger groups.
 */
function findGroup(topology: Topology, knowledge: Knowledge, live: Live, wanted: (lines: number) => boolean, level: number): DeductionStep | null {
  const { size, regionCount, regionOf } = topology;
  const openRegions = Array.from({ length: regionCount }, (_, region) => region).filter((region) => !knowledge.done[region]);
  for (const kind of ["row", "column"] as const) {
    const base = regionCount + (kind === "row" ? 0 : size);
    const openLines = Array.from({ length: size }, (_, line) => line).filter((line) => !knowledge.done[base + line]);
    if (openLines.length < 4) continue;
    // Bit i of a mask stands for openLines[i].
    const bitOf = new Map(openLines.map((line, bit) => [line, 1 << bit]));
    const lineMask = openRegions.map((region) => live[region].reduce((mask, cell) => mask | bitOf.get(lineIndex(topology, kind, cell))!, 0));
    const full = (1 << openLines.length) - 1;

    let best: { mask: number; count: number } | null = null;
    for (let mask = 1; mask < full; mask++) {
      let count = 0;
      for (let bits = mask; bits; bits &= bits - 1) count++;
      const smaller = Math.min(count, openLines.length - count);
      if (smaller < 2 || !wanted(smaller) || (best && smaller >= Math.min(best.count, openLines.length - best.count))) continue;
      let inside = 0;
      for (const regionMask of lineMask) if ((regionMask & ~mask) === 0) inside++;
      if (inside !== count) continue;
      // The regions inside own these lines. It only matters when another region still has a free cell there.
      if (lineMask.some((regionMask) => (regionMask & ~mask) !== 0 && (regionMask & mask) !== 0)) best = { mask, count };
    }
    if (!best) continue;

    const { mask } = best;
    const inside = openRegions.filter((_, index) => (lineMask[index] & ~mask) === 0);
    const outside = openRegions.filter((_, index) => (lineMask[index] & ~mask) !== 0);
    const members = new Set(inside);
    const eliminate = openLines.filter((line) => bitOf.get(line)! & mask).flatMap((line) => live[base + line].filter((cell) => !members.has(regionOf[cell])));
    if (best.count <= openLines.length - best.count) {
      return { technique: "region-group", level, place: null, eliminate, units: inside, lines: openLines.filter((line) => bitOf.get(line)! & mask).map((line) => base + line) };
    }
    return { technique: "line-group", level, place: null, eliminate, units: outside, lines: openLines.filter((line) => !(bitOf.get(line)! & mask)).map((line) => base + line) };
  }
  return null;
}

/** Longest chain of singles a trial follows before giving up. */
const TRIAL_DEPTH = 12;

/**
 * Last resort. Suppose a queen on a free cell, then keep placing the queens
 * that become forced. If a group ends up with no free cell, the supposed queen
 * was impossible. Only singles are followed, so the chain can be checked by eye.
 */
function findTrial(topology: Topology, knowledge: Knowledge): DeductionStep | null {
  for (let cell = 0; cell < topology.cellCount; cell++) {
    if (knowledge.free[cell] === 0) continue;
    const trial: Knowledge = { free: knowledge.free.slice(), queens: [...knowledge.queens], done: knowledge.done.slice() };
    placeQueen(topology, trial, cell);
    for (let depth = 0; depth < TRIAL_DEPTH; depth++) {
      if (isContradiction(topology, trial)) return { technique: "trial", level: 6, place: null, eliminate: [cell], units: [starvedUnit(topology, trial)], lines: [] };
      if (trial.queens.length >= topology.size) break;
      const single = findSingle(topology, trial, liveCells(topology, trial));
      if (!single) break;
      placeQueen(topology, trial, single.place!);
    }
  }
  return null;
}

function starvedUnit(topology: Topology, knowledge: Knowledge): number {
  return topology.units.findIndex((unit, index) => !knowledge.done[index] && unit.cells.every((cell) => knowledge.free[cell] === 0));
}

/** The easiest step available, or null when the ladder has nothing to offer (or the position is contradictory). */
export function nextStep(topology: Topology, knowledge: Knowledge): DeductionStep | null {
  if (knowledge.queens.length >= topology.size || isContradiction(topology, knowledge)) return null;
  const live = liveCells(topology, knowledge);
  return (
    findSingle(topology, knowledge, live) ??
    findConfined(topology, knowledge, live) ??
    findBlocker(topology, knowledge, live, 2, 2, 3) ??
    findGroup(topology, knowledge, live, (lines) => lines === 2, 4) ??
    findBlocker(topology, knowledge, live, 3, 4, 4) ??
    findGroup(topology, knowledge, live, (lines) => lines >= 3, 5) ??
    findBlocker(topology, knowledge, live, 5, topology.cellCount, 5) ??
    findTrial(topology, knowledge)
  );
}

export type Deduction = {
  /** Every queen was placed by deduction alone. */
  solved: boolean;
  steps: DeductionStep[];
  /** Queens in the order they were placed. */
  queens: number[];
  maxLevel: number;
  /** Steps per level, index 0 is level 1. */
  levels: number[];
  score: number;
};

/** Runs the ladder until the board is full or no technique applies. Mutates `knowledge`. */
export function deduce(topology: Topology, knowledge: Knowledge = createKnowledge(topology)): Deduction {
  const steps: DeductionStep[] = [];
  const levels = new Array<number>(MAX_LEVEL).fill(0);
  let maxLevel = 0;
  let score = 0;
  for (;;) {
    const step = nextStep(topology, knowledge);
    if (!step) break;
    applyStep(topology, knowledge, step);
    steps.push(step);
    levels[step.level - 1]++;
    maxLevel = Math.max(maxLevel, step.level);
    score += LEVEL_WEIGHTS[step.level - 1];
  }
  return { solved: knowledge.queens.length === topology.size && !isContradiction(topology, knowledge), steps, queens: [...knowledge.queens], maxLevel, levels, score };
}
