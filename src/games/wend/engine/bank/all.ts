import type { GameLanguage } from "@/i18n/game-language";
import { installWendBank } from "../themes";
import { WEND_THEMES as english } from "./en";
import { WEND_THEMES as portuguese } from "./pt-br";
import type { WendTheme } from "./types";

/**
 * Every word bank, in memory from the start. This file is for command-line
 * tools and tests, which reach it through the engine's index and can then
 * generate in any language without waiting for a download.
 *
 * Nothing the browser runs may import it, or both languages would be bundled
 * together again. tests/wend/bank.test.ts checks that.
 */
export const WEND_BANKS: Record<GameLanguage, readonly WendTheme[]> = { "pt-br": portuguese, en: english };

for (const [language, bank] of Object.entries(WEND_BANKS)) installWendBank(language as GameLanguage, bank);
