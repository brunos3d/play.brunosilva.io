/**
 * Every language's word list, loaded at once. For command-line tools and for
 * the browser tests' own Node code, which need the words without waiting.
 *
 * The app must never import this file. It loads one language on demand with
 * `loadTermoWords`, so a player downloads only the list being played.
 */
import { type TermoLanguage, registerTermoWords } from "@/games/termo/engine";
import { WORDS as ENGLISH } from "@/games/termo/engine/words/en";
import { WORDS as PORTUGUESE } from "@/games/termo/engine/words/pt-br";
import { parseArgs } from "../shared/cli";

registerTermoWords("pt-br", PORTUGUESE);
registerTermoWords("en", ENGLISH);

export const TERMO_LANGUAGES: readonly TermoLanguage[] = ["pt-br", "en"];

/** The languages a tool was asked for with `--lang en` or `--lang pt-br`. Every language when the flag is missing. */
export function languagesFromArgs(args: ReturnType<typeof parseArgs>): readonly TermoLanguage[] {
  if (args.lang === undefined) return TERMO_LANGUAGES;
  const wanted = TERMO_LANGUAGES.find((language) => language === String(args.lang).toLowerCase());
  if (!wanted) {
    console.error(`Unknown language "${String(args.lang)}". Use ${TERMO_LANGUAGES.join(" or ")}.`);
    process.exit(1);
  }
  return [wanted];
}
