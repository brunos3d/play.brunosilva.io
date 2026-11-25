import type { GameLanguage } from "@/i18n/game-language";
import type { WendTheme } from "./bank/types";
import { displayWord, plainLetters } from "./text";

export type BankWord = { text: string; display: string };
export type Theme = { title: string; byLength: ReadonlyMap<number, readonly BankWord[]> };

/**
 * One word bank per language, each in a file of its own behind a dynamic
 * import. The bundler turns each into a separate chunk, so a player only ever
 * downloads the bank of the language they play in.
 */
const SOURCES: Record<GameLanguage, () => Promise<{ WEND_THEMES: readonly WendTheme[] }>> = {
  "pt-br": () => import("./bank/pt-br"),
  en: () => import("./bank/en"),
};

const loaded = new Map<GameLanguage, readonly Theme[]>();
const loading = new Map<GameLanguage, Promise<readonly Theme[]>>();

/** A bank with every word in board letters and grouped by length, which is what the generator works with. */
export function parseWendBank(bank: readonly WendTheme[]): readonly Theme[] {
  return bank.map((theme) => {
    const byLength = new Map<number, BankWord[]>();
    for (const word of theme.words.split(" ")) {
      const text = plainLetters(word);
      const group = byLength.get(text.length) ?? [];
      group.push({ text, display: displayWord(word) });
      byLength.set(text.length, group);
    }
    return { title: theme.title, byLength };
  });
}

/**
 * Makes a bank that is already in memory the bank of a language. Tools and
 * tests import the banks directly and install them, so they can generate
 * without waiting. The app never does: it calls `loadWendBank`.
 */
export function installWendBank(language: GameLanguage, bank: readonly WendTheme[]): readonly Theme[] {
  const themes = parseWendBank(bank);
  loaded.set(language, themes);
  return themes;
}

/** Downloads the bank of a language, once. Later calls for the same language resolve at once. */
export function loadWendBank(language: GameLanguage): Promise<readonly Theme[]> {
  const ready = loaded.get(language);
  if (ready) return Promise.resolve(ready);
  let pending = loading.get(language);
  if (!pending) {
    const source = SOURCES[language];
    if (!source) return Promise.reject(new RangeError(`Wend has no word bank for the language "${language}".`));
    pending = source().then(
      (module) => loaded.get(language) ?? installWendBank(language, module.WEND_THEMES),
      (error: unknown) => {
        // A failed download must not stick: the next puzzle tries again.
        loading.delete(language);
        throw new Error(`The Wend word bank for "${language}" could not be downloaded. Check the connection and reload the page.`, { cause: error });
      },
    );
    loading.set(language, pending);
  }
  return pending;
}

export const isWendBankLoaded = (language: GameLanguage): boolean => loaded.has(language);

/**
 * The themes of a language. The bank must be in memory already: the generator
 * is synchronous and cannot wait for a download. Reaching this without the
 * bank is a bug in the caller, never something a player did.
 */
export function wendThemes(language: GameLanguage): readonly Theme[] {
  const themes = loaded.get(language);
  if (!themes) throw new Error(`The Wend word bank for "${language}" is not loaded. Await loadWendBank("${language}") before generating, or use loadWendPuzzle.`);
  return themes;
}
