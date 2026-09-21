import { type Difficulty, isDifficulty } from "./difficulty";

/**
 * Seeds look the same in every game:
 *
 *   <PREFIX>:<token>:<version>:<difficulty>[:<size>]
 *   ZIP:2026-09-21:1:hard      PATCHES:lucky:1:easy:10
 *
 * Each game creates one codec with its own prefix, supported generator versions
 * and board size range. The version is part of the PRNG key, so a generator
 * change never alters the board an old seed produces.
 */
export type PuzzleSpec = {
  /** Free-form part of the seed: a date, a number, a word. Never contains ":". */
  token: string;
  version: number;
  difficulty: Difficulty;
  /** Board edge length. Missing means the difficulty tier picks it. */
  size?: number;
};

export type SeedCodecOptions = {
  prefix: string;
  currentVersion: number;
  supportedVersions: readonly number[];
  minSize: number;
  maxSize: number;
};

export type LooseSeedInput = {
  seed: string;
  difficulty?: string | null;
  size?: string | number | null;
  version?: string | number | null;
};

export type SeedCodec = SeedCodecOptions & {
  isBoardSize: (value: unknown) => value is number;
  isSupportedVersion: (version: number) => boolean;
  format: (spec: PuzzleSpec) => string;
  parse: (seed: string) => PuzzleSpec | null;
  /** Accepts a canonical seed, or a bare token plus optional difficulty, size and version. */
  resolve: (input: LooseSeedInput) => PuzzleSpec;
  /** The string that seeds the PRNG. Every field that changes the puzzle is in it. */
  rngKey: (spec: PuzzleSpec) => string;
};

const MAX_TOKEN_LENGTH = 64;

/** Makes any user input safe for a seed: no separators, no whitespace, bounded length. */
export function normalizeToken(input: string | number): string {
  const cleaned = String(input)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, MAX_TOKEN_LENGTH);
  return cleaned.length > 0 ? cleaned : "0";
}

export function createSeedCodec(options: SeedCodecOptions): SeedCodec {
  const isBoardSize = (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= options.minSize && (value as number) <= options.maxSize;

  const format = (spec: PuzzleSpec): string => {
    const parts = [options.prefix, normalizeToken(spec.token), String(spec.version), spec.difficulty];
    if (spec.size !== undefined) parts.push(String(spec.size));
    return parts.join(":");
  };

  const parse = (seed: string): PuzzleSpec | null => {
    const parts = seed.trim().split(":");
    if (parts.length < 4 || parts.length > 5 || parts[0].toUpperCase() !== options.prefix) return null;
    const [, token, versionText, difficulty, sizeText] = parts;
    const version = Number(versionText);
    if (!Number.isInteger(version) || version < 1) return null;
    if (!isDifficulty(difficulty)) return null;
    if (token.length === 0 || normalizeToken(token) !== token) return null;
    if (sizeText === undefined) return { token, version, difficulty };
    const size = Number(sizeText);
    return isBoardSize(size) ? { token, version, difficulty, size } : null;
  };

  const resolve = (input: LooseSeedInput): PuzzleSpec => {
    const canonical = parse(input.seed);
    if (canonical) return canonical;
    const size = input.size === null || input.size === undefined || input.size === "" ? NaN : Number(input.size);
    const version = Number(input.version);
    return {
      token: normalizeToken(input.seed),
      version: Number.isInteger(version) && version >= 1 ? version : options.currentVersion,
      difficulty: isDifficulty(input.difficulty) ? input.difficulty : "medium",
      ...(isBoardSize(size) ? { size } : {}),
    };
  };

  return {
    ...options,
    isBoardSize,
    isSupportedVersion: (version) => options.supportedVersions.includes(version),
    format,
    parse,
    resolve,
    rngKey: (spec) => [options.prefix, `v${spec.version}`, normalizeToken(spec.token), spec.difficulty, spec.size ?? "auto"].join("|"),
  };
}
