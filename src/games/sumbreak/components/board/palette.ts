/**
 * Tile colours, one per power of two. They are pastel fabric colours in both
 * themes, with dark ink on top, the same choice Patches makes for its patches.
 * The hue walks from cool to warm as the numbers grow, and starts again deeper
 * after ten steps. The number is always printed, so colour is never the only cue.
 */
const COLORS = ["#b9c0f2", "#a8d3ea", "#a3ddd0", "#b6dba6", "#dfe08c", "#f3dc8f", "#f6c89f", "#f2b5b0", "#efb0cf", "#d3b6ea", "#9aa5ea", "#7fc1e6", "#79cdb9", "#99cf80"];

export function tileColor(value: number): string {
  const step = Math.max(0, Math.round(Math.log2(Math.max(1, value))));
  return COLORS[step % COLORS.length];
}
