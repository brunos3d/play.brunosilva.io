import type { Clue, PuzzleShape, Rect } from "@/games/patches/engine";

/** LinkedIn Patches #188 "V Shapes" (2026-09-21), 0-indexed, as published by answer sites. */
export const REAL_188: PuzzleShape = {
  width: 6,
  height: 6,
  clues: [
    { id: "a", row: 0, column: 2, area: 6 },
    { id: "b", row: 1, column: 1 },
    { id: "c", row: 1, column: 2, area: 5 },
    { id: "d", row: 4, column: 3 },
    { id: "e", row: 4, column: 4, area: 8 },
    { id: "f", row: 5, column: 3 },
  ],
};

export const REAL_188_SOLUTION: Rect[] = [
  { row: 0, column: 0, width: 6, height: 1 },
  { row: 1, column: 0, width: 2, height: 5 },
  { row: 1, column: 2, width: 1, height: 5 },
  { row: 1, column: 3, width: 1, height: 4 },
  { row: 1, column: 4, width: 2, height: 4 },
  { row: 5, column: 3, width: 3, height: 1 },
];

/**
 * 4x4 with four 2x2 quadrants:
 *   A A B B
 *   A A B B
 *   C C D D
 *   C C D D
 */
export function quadrants(overrides: Partial<Record<"a" | "b" | "c" | "d", Partial<Clue>>> = {}): PuzzleShape {
  const base: Clue[] = [
    { id: "a", row: 0, column: 0, area: 4, shape: "square" },
    { id: "b", row: 0, column: 3, area: 4, shape: "square" },
    { id: "c", row: 3, column: 0, area: 4, shape: "square" },
    { id: "d", row: 3, column: 3, area: 4, shape: "square" },
  ];
  return { width: 4, height: 4, clues: base.map((clue) => ({ ...clue, ...overrides[clue.id as "a"] })) };
}

export const QUADRANT_RECTS: Record<"a" | "b" | "c" | "d", Rect> = {
  a: { row: 0, column: 0, width: 2, height: 2 },
  b: { row: 0, column: 2, width: 2, height: 2 },
  c: { row: 2, column: 0, width: 2, height: 2 },
  d: { row: 2, column: 2, width: 2, height: 2 },
};
