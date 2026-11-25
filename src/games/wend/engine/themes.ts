import { WEND_THEMES } from "./bank/pt-br";
import { displayWord, plainLetters } from "./text";

export type BankWord = { text: string; display: string };
export type Theme = { title: string; byLength: ReadonlyMap<number, readonly BankWord[]> };

let parsed: readonly Theme[] | null = null;

/** The bank, with every word in board letters and grouped by length. Built on first use. */
export function wendThemes(): readonly Theme[] {
  if (!parsed) {
    parsed = WEND_THEMES.map((theme) => {
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
  return parsed;
}
