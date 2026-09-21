import { hashString } from "@/shared/engine/prng";
import type { Clue } from "../../engine/types";

/** Pastel fabric colours. All keep dark ink readable at AA contrast. */
export const PATCH_COLORS = [
  { name: "rose", value: "#f2b5b0" },
  { name: "sky", value: "#a8d3ea" },
  { name: "butter", value: "#f3dc8f" },
  { name: "sage", value: "#bfd8a8" },
  { name: "lilac", value: "#d3b6ea" },
  { name: "apricot", value: "#f6c89f" },
  { name: "mint", value: "#a9dcc6" },
  { name: "periwinkle", value: "#b7bef0" },
  { name: "clay", value: "#e3b79a" },
  { name: "teal", value: "#9fd0d0" },
  { name: "pink", value: "#f0b3d1" },
  { name: "moss", value: "#cfd496" },
] as const;

export type PatchColor = (typeof PATCH_COLORS)[number];

/**
 * One colour per clue. The colour belongs to the clue, so it is visible before
 * the patch exists. Only clue positions feed the choice, never the solution, so
 * colours cannot leak where a patch ends. Each clue takes the colour whose
 * nearest same-coloured clue is farthest away, which keeps neighbours distinct.
 */
export function assignPatchColors(clues: readonly Clue[], paletteSeed: string): Map<string, PatchColor> {
  const offset = hashString(paletteSeed)[0] % PATCH_COLORS.length;
  const assigned = new Map<string, PatchColor>();
  const used: { clue: Clue; colorIndex: number }[] = [];

  for (const clue of clues) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let step = 0; step < PATCH_COLORS.length; step++) {
      const colorIndex = (offset + step) % PATCH_COLORS.length;
      let nearest = Infinity;
      for (const other of used) {
        if (other.colorIndex !== colorIndex) continue;
        nearest = Math.min(nearest, Math.abs(other.clue.row - clue.row) + Math.abs(other.clue.column - clue.column));
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = colorIndex;
      }
    }
    used.push({ clue, colorIndex: bestIndex });
    assigned.set(clue.id, PATCH_COLORS[bestIndex]);
  }
  return assigned;
}
