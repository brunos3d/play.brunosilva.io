import { cellIndex, rectEquals } from "../board/geometry";
import { clueAccepts } from "../clues/clue";
import type { PuzzleShape, Rect } from "../types";

const BITS_PER_WORD = 32;

export type Candidate = {
  index: number;
  clueIndex: number;
  rect: Rect;
  /** Cell indices covered by the rectangle, row-major. */
  cells: number[];
  /** Bitmask over cell indices, 32 bits per word. */
  mask: Int32Array;
};

export type CandidateSet = {
  width: number;
  height: number;
  cellCount: number;
  words: number;
  candidates: Candidate[];
  /** Candidate indices grouped by clue index. */
  byClue: number[][];
  /** Candidate indices grouped by covered cell index. */
  byCell: number[][];
};

export function masksOverlap(a: Int32Array, b: Int32Array): boolean {
  for (let i = 0; i < a.length; i++) {
    if ((a[i] & b[i]) !== 0) return true;
  }
  return false;
}

export function maskHas(mask: Int32Array, cell: number): boolean {
  return (mask[cell >>> 5] & (1 << (cell & 31))) !== 0;
}

/**
 * Lists every rectangle each clue could own: inside the board, accepted by the
 * clue's number and shape, and free of other clue cells. A 2D prefix sum over
 * clue cells makes the "exactly one clue inside" test constant time.
 */
export function buildCandidates(puzzle: PuzzleShape): CandidateSet {
  const { width, height, clues } = puzzle;
  const cellCount = width * height;
  const words = Math.ceil(cellCount / BITS_PER_WORD);

  const stride = width + 1;
  const prefix = new Int32Array(stride * (height + 1));
  const clueAt = new Uint8Array(cellCount);
  for (const clue of clues) clueAt[cellIndex(width, clue.row, clue.column)]++;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      prefix[(row + 1) * stride + column + 1] =
        clueAt[cellIndex(width, row, column)] +
        prefix[row * stride + column + 1] +
        prefix[(row + 1) * stride + column] -
        prefix[row * stride + column];
    }
  }
  const cluesIn = (top: number, left: number, bottom: number, right: number): number =>
    prefix[(bottom + 1) * stride + right + 1] -
    prefix[top * stride + right + 1] -
    prefix[(bottom + 1) * stride + left] +
    prefix[top * stride + left];

  const candidates: Candidate[] = [];
  const byClue: number[][] = clues.map(() => []);
  const byCell: number[][] = Array.from({ length: cellCount }, () => []);

  clues.forEach((clue, clueIndex) => {
    for (let top = 0; top <= clue.row; top++) {
      for (let bottom = clue.row; bottom < height; bottom++) {
        const rectHeight = bottom - top + 1;
        for (let left = 0; left <= clue.column; left++) {
          for (let right = clue.column; right < width; right++) {
            const rectWidth = right - left + 1;
            if (!clueAccepts(clue, rectWidth, rectHeight)) continue;
            if (cluesIn(top, left, bottom, right) !== 1) continue;

            const mask = new Int32Array(words);
            const cells: number[] = [];
            for (let row = top; row <= bottom; row++) {
              for (let column = left; column <= right; column++) {
                const cell = cellIndex(width, row, column);
                cells.push(cell);
                mask[cell >>> 5] |= 1 << (cell & 31);
              }
            }
            const index = candidates.length;
            candidates.push({
              index,
              clueIndex,
              rect: { row: top, column: left, width: rectWidth, height: rectHeight },
              cells,
              mask,
            });
            byClue[clueIndex].push(index);
            for (const cell of cells) byCell[cell].push(index);
          }
        }
      }
    }
  });

  return { width, height, cellCount, words, candidates, byClue, byCell };
}

export function findCandidate(set: CandidateSet, clueIndex: number, rect: Rect): Candidate | null {
  for (const index of set.byClue[clueIndex] ?? []) {
    if (rectEquals(set.candidates[index].rect, rect)) return set.candidates[index];
  }
  return null;
}
