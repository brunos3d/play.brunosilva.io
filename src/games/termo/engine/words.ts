import type { GameLanguage } from "@/i18n/game-language";

/**
 * The word lists, one set per language, read from the generated modules in
 * ./words/<language>. A language is loaded on demand with `loadTermoWords`, so
 * a Portuguese game never downloads the English lists and the reverse. The
 * accessors below are synchronous and take the language. They throw when that
 * language was not loaded first, which is a bug in the caller.
 *
 * The lists ship as long strings and are cut up on first use, so loading the
 * game costs one string each and no parsing of ten thousand array items.
 *
 * Every word is handled in its plain form: lower case, five letters a to z, no
 * accents and no cedilla. "maçã" is typed, stored and compared as "maca". The
 * accented spelling only comes back when a word is shown.
 */
export type TermoLanguage = GameLanguage;

export const WORD_LENGTH = 5;

/** What the generated modules of one language hold. */
export type TermoWordData = {
  /** Every answer, five plain letters each, joined, from the most common word down. */
  answers: string;
  /** How many answers, counted from the most common, the easy tier draws from. */
  easyCount: number;
  /** The other accepted guesses, joined the same way. */
  guesses: string;
  /** Words written with an accent or a cedilla, separated by spaces. Missing for a language without them. */
  accented?: string;
};

/** Strips accents and the cedilla and lowers the case. Anything that is not a letter is dropped. */
export function plainLetters(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const chunk = (text: string): string[] => {
  const words: string[] = [];
  for (let index = 0; index + WORD_LENGTH <= text.length; index += WORD_LENGTH) words.push(text.slice(index, index + WORD_LENGTH));
  return words;
};

type Lists = { data: TermoWordData; answers: readonly string[]; known: Set<string> | null; accents: Map<string, string> | null };

const lists = new Map<TermoLanguage, Lists>();
const loading = new Map<TermoLanguage, Promise<void>>();

/** One dynamic import per language. The bundler turns each into its own chunk. */
const SOURCES: Record<TermoLanguage, () => Promise<{ WORDS: TermoWordData }>> = {
  "pt-br": () => import("./words/pt-br"),
  en: () => import("./words/en"),
};

/** Hands a language's lists to the accessors. `loadTermoWords` calls it. Command-line tools call it with modules they import directly. */
export function registerTermoWords(language: TermoLanguage, data: TermoWordData): void {
  if (!lists.has(language)) lists.set(language, { data, answers: chunk(data.answers), known: null, accents: null });
}

/** Downloads the lists of one language, once. Resolves at once when they are already here. */
export function loadTermoWords(language: TermoLanguage): Promise<void> {
  if (lists.has(language)) return Promise.resolve();
  let pending = loading.get(language);
  if (!pending) {
    const source = SOURCES[language];
    if (!source) return Promise.reject(new RangeError(`Termo has no word list for "${language}".`));
    pending = source().then(
      (module) => registerTermoWords(language, module.WORDS),
      (error: unknown) => {
        // Forget the failure, so that a later call asks again.
        loading.delete(language);
        throw error;
      },
    );
    loading.set(language, pending);
  }
  return pending;
}

export const hasTermoWords = (language: TermoLanguage): boolean => lists.has(language);

function listsOf(language: TermoLanguage): Lists {
  const found = lists.get(language);
  if (!found) throw new Error(`The Termo word list for "${language}" is not loaded. Await loadTermoWords("${language}") before using it.`);
  return found;
}

/** Every answer of a language, from the most common word down. */
export function answerWords(language: TermoLanguage): readonly string[] {
  return listsOf(language).answers;
}

/** How many answers, counted from the most common, the easy tier draws from. */
export function easyPoolSize(language: TermoLanguage): number {
  return listsOf(language).data.easyCount;
}

function knownWords(language: TermoLanguage): Set<string> {
  const entry = listsOf(language);
  entry.known ??= new Set([...entry.answers, ...chunk(entry.data.guesses)]);
  return entry.known;
}

/** True for a word the game takes as a guess in that language. Expects the plain form. */
export function isKnownWord(word: string, language: TermoLanguage): boolean {
  return knownWords(language).has(word);
}

export function knownWordCount(language: TermoLanguage): number {
  return knownWords(language).size;
}

/** The word as it is written, with its accents: "maca" comes back as "maçã" in Portuguese. Unknown words, and every English word, come back unchanged. */
export function displayWord(word: string, language: TermoLanguage): string {
  const entry = listsOf(language);
  if (!entry.accents) {
    entry.accents = new Map();
    for (const spelled of (entry.data.accented ?? "").split(" ")) if (spelled !== "") entry.accents.set(plainLetters(spelled), spelled);
  }
  return entry.accents.get(word) ?? word;
}
