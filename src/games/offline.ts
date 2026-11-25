import type { GameLanguage } from "@/i18n/game-language";

/**
 * Downloads what a game needs beyond its page to be played offline: the word
 * list of Termo and the word bank of Wend, in the player's game language.
 *
 * Those files are loaded on demand, one language at a time, so no page's HTML
 * names them and the service worker cannot find them by reading the pages it
 * precaches. Fetching them here, once the worker controls the page, puts them
 * in its cache. Only the player's language is fetched. The other one is cached
 * the first time it is played.
 *
 * The imports are dynamic on purpose: this module is reached from the root
 * layout, and it must not pull a word list into every page's bundle.
 */
export async function warmOfflineData(language: GameLanguage): Promise<void> {
  await Promise.allSettled([
    import("@/games/termo/engine/words").then((words) => words.loadTermoWords(language)),
    import("@/games/wend/engine/themes").then((themes) => themes.loadWendBank(language)),
  ]);
}
