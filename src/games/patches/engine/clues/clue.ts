import type { Clue, ShapeConstraint } from "../types";

/** Strict inequalities: a square is neither tall nor wide. A 1x1 is a square. */
export function shapeAccepts(shape: ShapeConstraint | undefined, width: number, height: number): boolean {
  switch (shape) {
    case "square":
      return width === height;
    case "tall":
      return height > width;
    case "wide":
      return width > height;
    case "freeform":
    case "unconstrained":
    case undefined:
      return true;
  }
}

export function areaAccepts(area: number | undefined, width: number, height: number): boolean {
  return area === undefined || area === width * height;
}

export function clueAccepts(clue: Clue, width: number, height: number): boolean {
  return areaAccepts(clue.area, width, height) && shapeAccepts(clue.shape, width, height);
}

export function hasShapeRule(clue: Clue): boolean {
  return clue.shape === "square" || clue.shape === "tall" || clue.shape === "wide";
}

/** Information level of a clue, from 0 (nothing) to 2 (number and a real shape rule). */
export function clueInformation(clue: Clue): 0 | 1 | 2 {
  const level = (clue.area !== undefined ? 1 : 0) + (hasShapeRule(clue) ? 1 : 0);
  return level as 0 | 1 | 2;
}

const SHAPE_PHRASES: Record<ShapeConstraint, string> = {
  square: "a square",
  tall: "a tall rectangle",
  wide: "a wide rectangle",
  freeform: "any rectangle",
  unconstrained: "any rectangle",
};

/** Plain-language description, used for ARIA labels and hint text. */
export function describeClue(clue: Clue): string {
  const shape = SHAPE_PHRASES[clue.shape ?? "unconstrained"];
  if (clue.area !== undefined) {
    const cells = clue.area === 1 ? "1 cell" : `${clue.area} cells`;
    return hasShapeRule(clue) ? `${shape} of ${cells}` : `${cells}, ${shape}`;
  }
  return hasShapeRule(clue) ? `${shape} of unknown size` : "unknown size, any rectangle";
}
