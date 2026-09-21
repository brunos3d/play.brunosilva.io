/**
 * Deterministic randomness for the puzzle engine.
 *
 * Hash: cyrb128 turns any string into 128 bits of state.
 * Generator: sfc32 (Small Fast Counter). It keeps 128 bits of state, passes
 * PractRand, and only uses 32-bit integer math, so every JS engine produces
 * the same sequence. Mulberry32 was rejected because its 32-bit state limits
 * the number of distinct streams and it fails statistical tests sooner.
 *
 * Nothing in this file reads the clock, Math.random or any other ambient state.
 */

export type Rng = {
  /** Float in [0, 1). */
  next: () => number;
  /** Integer in [0, maxExclusive). */
  int: (maxExclusive: number) => number;
  /** Integer in [min, max], both inclusive. */
  range: (min: number, max: number) => number;
  /** True with the given probability. */
  chance: (probability: number) => boolean;
  /** Uniform pick. Throws on an empty list. */
  pick: <T>(items: readonly T[]) => T;
  /** Pick using non-negative weights. Throws when every weight is zero. */
  weighted: <T>(items: readonly T[], weights: readonly number[]) => T;
  /** Fisher-Yates shuffle that returns a new array. */
  shuffle: <T>(items: readonly T[]) => T[];
};

const UINT32_RANGE = 4294967296;

export function hashString(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Short hex digest of a string. Used for puzzle ids and duplicate detection. */
export function hashHex(input: string): string {
  return hashString(input)
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / UINT32_RANGE;
  };
}

const WARMUP_ROUNDS = 12;

export function createRng(seed: string | number): Rng {
  const [a, b, c, d] = hashString(String(seed));
  const next = sfc32(a, b, c, d);
  for (let i = 0; i < WARMUP_ROUNDS; i++) next();

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`int() needs a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  const weighted = <T>(items: readonly T[], weights: readonly number[]): T => {
    if (items.length === 0 || items.length !== weights.length) {
      throw new RangeError("weighted() needs matching, non-empty lists");
    }
    let total = 0;
    for (const weight of weights) total += Math.max(0, weight);
    if (total <= 0) throw new RangeError("weighted() needs a positive weight");
    let roll = next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= Math.max(0, weights[i]);
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  };

  return {
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    chance: (probability) => next() < probability,
    pick: (items) => {
      if (items.length === 0) throw new RangeError("pick() needs items");
      return items[int(items.length)];
    },
    weighted,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
