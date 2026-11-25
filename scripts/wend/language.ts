import { type GameLanguage, isGameLanguage } from "@/i18n/game-language";
import { WEND_BANKS } from "@/games/wend/engine";

/**
 * Reads `--lang en` or `--lang pt-br`. Without the flag the tools work in
 * Portuguese, the language of a seed that names none.
 */
export function languageArg(value: string | true | undefined): GameLanguage {
  if (value === undefined) return "pt-br";
  if (typeof value === "string" && isGameLanguage(value.toLowerCase()) && value.toLowerCase() in WEND_BANKS) return value.toLowerCase() as GameLanguage;
  console.error(`Unknown language "${String(value)}". Use ${Object.keys(WEND_BANKS).join(" or ")}.`);
  process.exit(1);
}
