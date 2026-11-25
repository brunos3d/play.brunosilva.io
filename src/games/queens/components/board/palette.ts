import { createRng } from "@/shared/engine/prng";
import { sideNeighbors } from "../../engine/grid";
import type { QueensShape } from "../../engine/types";

/** Pastel fabric colours, the same family Patches uses. All keep dark ink readable at AA contrast. `name` is an id: what a player reads comes from the "queens" messages, under color.<name>. */
export const REGION_COLORS = [
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

export type RegionColor = (typeof REGION_COLORS)[number];

/** Pairs that are easy to confuse when they share a border. */
const ALIKE: readonly (readonly [string, string])[] = [
  ["rose", "pink"],
  ["rose", "apricot"],
  ["apricot", "clay"],
  ["rose", "clay"],
  ["sky", "teal"],
  ["sky", "periwinkle"],
  ["mint", "teal"],
  ["sage", "mint"],
  ["sage", "moss"],
  ["butter", "moss"],
  ["lilac", "periwinkle"],
  ["lilac", "pink"],
];
const alike = (a: string, b: string): boolean => ALIKE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const TRIES = 60;

/**
 * One colour per region, all different. The palette is shuffled by the puzzle
 * id, and of a fixed number of shuffles the one with the fewest look-alike
 * colours side by side wins. Only the regions feed the choice, never the
 * solution. Borders are drawn as lines as well, so colour is not the only cue.
 */
export function assignRegionColors(shape: QueensShape, paletteSeed: string): RegionColor[] {
  const { size, regions } = shape;
  const borders = new Set<string>();
  for (let cell = 0; cell < regions.length; cell++) {
    for (const next of sideNeighbors(size, cell)) if (regions[next] > regions[cell]) borders.add(`${regions[cell]}:${regions[next]}`);
  }
  const pairs = [...borders].map((key) => key.split(":").map(Number) as [number, number]);

  const rng = createRng(`queens-palette|${paletteSeed}`);
  let best: RegionColor[] = REGION_COLORS.slice(0, size);
  let bestClashes = Infinity;
  for (let attempt = 0; attempt < TRIES && bestClashes > 0; attempt++) {
    const colors = rng.shuffle(REGION_COLORS).slice(0, size);
    const clashes = pairs.reduce((sum, [a, b]) => sum + (alike(colors[a].name, colors[b].name) ? 1 : 0), 0);
    if (clashes < bestClashes) {
      best = colors;
      bestClashes = clashes;
    }
  }
  return best;
}
