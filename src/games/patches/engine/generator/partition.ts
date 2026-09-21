import type { Rng } from "@/shared/engine/prng";
import type { Rect } from "../types";

export type PartitionOptions = {
  width: number;
  height: number;
  meanArea: number;
  areaSpread: number;
};

const SINGLE_CELL_WEIGHT = 0.004;
const LONG_STRIP_LENGTH = 5;
const LONG_STRIP_PENALTY = 0.45;
const MAX_AREA_SHARE = 0.34;
const ABSOLUTE_MAX_AREA = 12;
const MAX_PARTITION_TRIES = 120;
const MIN_DISTINCT_SIZES = 3;

function rectWeight(width: number, height: number, options: PartitionOptions, maxArea: number): number {
  const area = width * height;
  if (area > maxArea) return 0;
  if (area === 1) return SINGLE_CELL_WEIGHT;
  const distance = area - options.meanArea;
  let weight = Math.exp(-(distance * distance) / (2 * options.areaSpread * options.areaSpread));
  if (Math.min(width, height) === 1 && Math.max(width, height) >= LONG_STRIP_LENGTH) weight *= LONG_STRIP_PENALTY;
  return weight;
}

/**
 * Fills the board in scan order. The first empty cell becomes the top-left
 * corner of a new rectangle whose size is drawn from a bell curve around
 * `meanArea`. Everything below the first empty cell is always free, so only the
 * width needs a collision check. A 1x1 always fits, so a fill never fails.
 */
function fillOnce(rng: Rng, options: PartitionOptions): Rect[] {
  const { width, height } = options;
  const taken = new Uint8Array(width * height);
  const maxArea = Math.min(ABSOLUTE_MAX_AREA, Math.max(4, Math.floor(width * height * MAX_AREA_SHARE)));
  const rects: Rect[] = [];

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (taken[row * width + column]) continue;

      let freeWidth = 0;
      while (column + freeWidth < width && !taken[row * width + column + freeWidth]) freeWidth++;

      const choices: Rect[] = [];
      const weights: number[] = [];
      for (let w = 1; w <= freeWidth; w++) {
        for (let h = 1; row + h <= height; h++) {
          const weight = rectWeight(w, h, options, maxArea);
          if (weight <= 0) continue;
          choices.push({ row, column, width: w, height: h });
          weights.push(weight);
        }
      }

      const rect = rng.weighted(choices, weights);
      for (let r = rect.row; r < rect.row + rect.height; r++) {
        taken.fill(1, r * width + rect.column, r * width + rect.column + rect.width);
      }
      rects.push(rect);
    }
  }
  return rects;
}

/** Mirrors and transposes the layout so the scan order leaves no visible bias. */
function randomSymmetry(rng: Rng, rects: Rect[], width: number, height: number): Rect[] {
  const transpose = width === height && rng.chance(0.5);
  const flipRows = rng.chance(0.5);
  const flipColumns = rng.chance(0.5);
  return rects.map((rect) => {
    let next = { ...rect };
    if (transpose) next = { row: next.column, column: next.row, width: next.height, height: next.width };
    if (flipRows) next = { ...next, row: height - next.row - next.height };
    if (flipColumns) next = { ...next, column: width - next.column - next.width };
    return next;
  });
}

function singleCellCount(rects: readonly Rect[]): number {
  return rects.filter((rect) => rect.width * rect.height === 1).length;
}

function distinctSizes(rects: readonly Rect[]): number {
  return new Set(rects.map((rect) => `${rect.width}x${rect.height}`)).size;
}

/**
 * Random rectangle tiling without 1x1 patches and with some variety in sizes.
 * If the retry budget runs out, the tiling with the fewest 1x1 patches wins.
 */
export function randomPartition(rng: Rng, options: PartitionOptions): Rect[] {
  let best: Rect[] | null = null;
  let bestSingles = Infinity;

  for (let attempt = 0; attempt < MAX_PARTITION_TRIES; attempt++) {
    const rects = fillOnce(rng, options);
    const singles = singleCellCount(rects);
    if (singles === 0 && distinctSizes(rects) >= Math.min(MIN_DISTINCT_SIZES, rects.length)) {
      best = rects;
      break;
    }
    if (singles < bestSingles) {
      best = rects;
      bestSingles = singles;
    }
  }

  const chosen = best ?? fillOnce(rng, options);
  return randomSymmetry(rng, chosen, options.width, options.height);
}
