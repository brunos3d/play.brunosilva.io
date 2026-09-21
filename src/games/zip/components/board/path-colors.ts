import { hashString } from "@/shared/engine/prng";

/** Fabric colour pairs. The path blends from the first to the second as it fills the board. */
const PAIRS: readonly [string, string][] = [
  ["#f2b5b0", "#f6c89f"],
  ["#a8d3ea", "#b7bef0"],
  ["#a9dcc6", "#cfd496"],
  ["#d3b6ea", "#f0b3d1"],
  ["#f3dc8f", "#f6c89f"],
  ["#9fd0d0", "#a8d3ea"],
  ["#f0b3d1", "#d3b6ea"],
  ["#bfd8a8", "#a9dcc6"],
];

const channel = (hex: string, offset: number): number => parseInt(hex.slice(offset, offset + 2), 16);

function mix(from: string, to: string, t: number): string {
  const part = (offset: number) => Math.round(channel(from, offset) + (channel(to, offset) - channel(from, offset)) * t);
  return `rgb(${part(1)} ${part(3)} ${part(5)})`;
}

/**
 * Colour of the path at each position. The blend is tied to the position on the
 * board, not to the current length, so a cell keeps its colour as the path grows.
 */
export function pathColors(puzzleId: string, cellCount: number): string[] {
  const [from, to] = PAIRS[hashString(puzzleId)[0] % PAIRS.length];
  return Array.from({ length: cellCount }, (_, index) => mix(from, to, cellCount > 1 ? index / (cellCount - 1) : 0));
}
