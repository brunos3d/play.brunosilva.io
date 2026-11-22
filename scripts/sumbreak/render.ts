import type { SumbreakShape } from "@/games/sumbreak/engine";

/** The board as text: one row per line, a dot for an empty cell. */
export function renderSumbreak(shape: SumbreakShape): string {
  const width = Math.max(...shape.cells.map((value) => String(value).length)) + 1;
  const rows: string[] = [];
  for (let row = 0; row < shape.size; row++) {
    rows.push(shape.cells.slice(row * shape.size, (row + 1) * shape.size).map((value) => (value === 0 ? "." : String(value)).padStart(width)).join(""));
  }
  return rows.join("\n");
}
