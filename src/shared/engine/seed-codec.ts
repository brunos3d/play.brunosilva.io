import { type Difficulty, isDifficulty } from "./difficulty";

/**
 * Seeds look the same in every game:
 *
 *   <PREFIX>:<token>:<version>:<difficulty>[:<size>][:<language>]
 *   ZIP:2026-09-21:1:hard      PATCHES:lucky:1:easy:10      TERMO:lucky:1:hard:en
 *
 * Each game creates one codec with its own prefix, supported generator versions
 * and board size range. The version is part of the PRNG key, so a generator
 * change never alters the board an old seed produces.
 *
 * A game whose puzzles are made of words also lists its languages. The seed
 * then names the language, so a shared link opens the same words for everyone,
 * whatever language the receiver plays in. The language the game first shipped
 * in is the `legacy` one: it is left out of the seed, which keeps every seed
 * made before the game had a second language valid and unchanged.
 */
export type PuzzleSpec = {
  /** Free-form part of the seed: a date, a number, a word. Never contains ":". */
  token: string;
  version: number;
  difficulty: Difficulty;
  /** Board edge length. Missing means the difficulty tier picks it. */
  size?: number;
  /** Language of the words. Only for games that list languages. Missing means the codec's legacy language. */
  lang?: string;
};

export type SeedLanguages = {
  supported: readonly string[];
  /** The language of a seed that names none. */
  legacy: string;
};

export type SeedCodecOptions = {
  prefix: string;
  currentVersion: number;
  supportedVersions: readonly number[];
  minSize: number;
  maxSize: number;
  /** Set by games whose puzzles depend on a language. */
  languages?: SeedLanguages;
};

export type LooseSeedInput = {
  seed: string;
  difficulty?: string | null;
  size?: string | number | null;
  version?: string | number | null;
  lang?: string | null;
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
  /** The language a spec is in: its own, or the legacy one. Undefined for a game without languages. */
  languageOf: (spec: PuzzleSpec) => string | undefined;
  /** The same spec in another language. A language the game does not have, or a game without languages, leaves the spec as it is. */
  withLanguage: (spec: PuzzleSpec, lang: string | null | undefined) => PuzzleSpec;
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
  const { languages } = options;
  const isBoardSize = (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= options.minSize && (value as number) <= options.maxSize;

  /** The language as the seed carries it: nothing for the legacy language, and nothing for a language the game does not have. */
  const seedLanguage = (lang: string | null | undefined): string | undefined => (languages && lang && lang !== languages.legacy && languages.supported.includes(lang) ? lang : undefined);

  const withLanguage = (spec: PuzzleSpec, lang: string | null | undefined): PuzzleSpec => {
    const rest: PuzzleSpec = { token: spec.token, version: spec.version, difficulty: spec.difficulty, ...(spec.size !== undefined ? { size: spec.size } : {}) };
    const next = seedLanguage(lang);
    return next ? { ...rest, lang: next } : rest;
  };

  const format = (spec: PuzzleSpec): string => {
    const parts = [options.prefix, normalizeToken(spec.token), String(spec.version), spec.difficulty];
    if (spec.size !== undefined) parts.push(String(spec.size));
    const lang = seedLanguage(spec.lang);
    if (lang) parts.push(lang);
    return parts.join(":");
  };

  const parse = (seed: string): PuzzleSpec | null => {
    const parts = seed.trim().split(":");
    if (parts.length < 4 || parts.length > 6 || parts[0].toUpperCase() !== options.prefix) return null;
    const [, token, versionText, difficulty, ...rest] = parts;
    const version = Number(versionText);
    if (!Number.isInteger(version) || version < 1) return null;
    if (!isDifficulty(difficulty)) return null;
    if (token.length === 0 || normalizeToken(token) !== token) return null;

    // After the difficulty come the size and the language, each optional, in that order. A size is a number and a language is not, so the two cannot be mistaken.
    const spec: PuzzleSpec = { token, version, difficulty };
    let index = 0;
    if (index < rest.length && /^\d+$/.test(rest[index])) {
      const size = Number(rest[index++]);
      if (!isBoardSize(size)) return null;
      spec.size = size;
    }
    if (index < rest.length) {
      const lang = rest[index++].toLowerCase();
      if (!languages || !languages.supported.includes(lang)) return null;
      if (lang !== languages.legacy) spec.lang = lang;
    }
    return index === rest.length ? spec : null;
  };

  const resolve = (input: LooseSeedInput): PuzzleSpec => {
    const canonical = parse(input.seed);
    if (canonical) return canonical;
    const size = input.size === null || input.size === undefined || input.size === "" ? NaN : Number(input.size);
    const version = Number(input.version);
    return withLanguage(
      {
        token: normalizeToken(input.seed),
        version: Number.isInteger(version) && version >= 1 ? version : options.currentVersion,
        difficulty: isDifficulty(input.difficulty) ? input.difficulty : "medium",
        ...(isBoardSize(size) ? { size } : {}),
      },
      input.lang?.toLowerCase(),
    );
  };

  return {
    ...options,
    isBoardSize,
    isSupportedVersion: (version) => options.supportedVersions.includes(version),
    format,
    parse,
    resolve,
    // The legacy language adds nothing to the key, so its puzzles are the ones the game always built.
    rngKey: (spec) => [options.prefix, `v${spec.version}`, normalizeToken(spec.token), spec.difficulty, spec.size ?? "auto", ...(seedLanguage(spec.lang) ? [seedLanguage(spec.lang) as string] : [])].join("|"),
    languageOf: (spec) => (languages ? (seedLanguage(spec.lang) ?? languages.legacy) : undefined),
    withLanguage,
  };
}
