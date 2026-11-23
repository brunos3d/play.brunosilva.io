import { hashString } from "@/shared/engine/prng";

/** Fabric colours for found words. The same pastels the other games use, so dark ink reads on all of them in both themes. */
const FABRICS = ["#f2b5b0", "#a8d3ea", "#a9dcc6", "#d3b6ea", "#f3dc8f", "#9fd0d0", "#f0b3d1", "#bfd8a8"] as const;

/** Colour of each hidden word. The puzzle id turns the wheel, so boards do not all start with the same colour. */
export function wordColors(puzzleId: string, count: number): string[] {
  const offset = hashString(puzzleId)[0] % FABRICS.length;
  return Array.from({ length: count }, (_, index) => FABRICS[(offset + index) % FABRICS.length]);
}
