import { describe, expect, it } from "vitest";
import { assignRegionColors } from "@/games/queens/components/board/palette";
import { DIFFICULTIES, generateQueensPuzzle, validateQueensPuzzle } from "@/games/queens/engine";

describe("queens tutorial and palette", () => {
  it("teaches on a board that only needs the simplest step", () => {
    // The tutorial dialog builds this exact board. Its text assumes an easy 5x5.
    const puzzle = generateQueensPuzzle("tutorial-1", "easy", { size: 5, version: 1 });
    expect(validateQueensPuzzle(puzzle).problems).toEqual([]);
    expect(puzzle.metadata.maxLevel).toBe(1);
    expect(puzzle.regions).toEqual([0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 4, 2, 2, 2, 1, 4, 4, 2, 3, 1, 4, 4, 2, 2, 1]);
  });

  it("gives every region its own colour, the same on every visit", () => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generateQueensPuzzle("palette", difficulty);
      const colors = assignRegionColors(puzzle, puzzle.id);
      expect(colors).toHaveLength(puzzle.size);
      expect(new Set(colors.map((color) => color.name)).size).toBe(puzzle.size);
      expect(assignRegionColors(puzzle, puzzle.id)).toEqual(colors);
    }
  });
});
