/**
 * npm run termo:validate -- [--count 200] [--from 2026-11-22 --days 365] [--lang en]
 * Audits the word lists, random seeds for every tier and a run of daily puzzles.
 * Runs every language unless --lang names one. Exits non-zero if anything has a problem.
 */
import {
  DIFFICULTIES,
  TERMO_EXAMPLES,
  type TermoLanguage,
  WORD_LENGTH,
  answerWords,
  displayWord,
  easyPoolSize,
  generateTermoFromSpec,
  generateTermoPuzzle,
  getTermoDailyInfo,
  isKnownWord,
  knownWordCount,
  plainLetters,
  termoDailyVariantSpec,
  validateTermoPuzzle,
} from "@/games/termo/engine";
import { addDays } from "@/shared/engine/pacific-time";
import { parseArgs } from "../shared/cli";
import { languagesFromArgs } from "./all-words";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 200);
const from = typeof args.from === "string" ? args.from : "2026-11-22";
const days = Number(args.days ?? 365);

function validateLanguage(language: TermoLanguage): string[] {
  const failures: string[] = [];

  // The lists themselves.
  const answers = answerWords(language);
  if (new Set(answers).size !== answers.length) failures.push("The answer list repeats a word.");
  if (easyPoolSize(language) > answers.length) failures.push("The easy pool is larger than the answer list.");
  for (const word of answers) {
    if (!new RegExp(`^[a-z]{${WORD_LENGTH}}$`).test(word)) failures.push(`answer "${word}" is not five plain letters`);
    if (!isKnownWord(word, language)) failures.push(`answer "${word}" cannot be typed as a guess`);
    const shown = displayWord(word, language);
    if ([...shown].length !== WORD_LENGTH || plainLetters(shown) !== word) failures.push(`answer "${word}" is shown as "${shown}"`);
  }
  for (const example of TERMO_EXAMPLES[language]) if (!isKnownWord(example.word, language)) failures.push(`tutorial word "${example.word}" is not an accepted guess`);

  let checked = 0;
  const audit = (label: string, problems: string[]) => {
    checked++;
    if (problems.length > 0) failures.push(`${label}: ${problems.join(" ")}`);
  };

  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < count; i++) {
      const puzzle = generateTermoPuzzle(`validate-${i}`, difficulty, { language });
      audit(puzzle.seed, validateTermoPuzzle(puzzle).problems);
    }
  }
  const dailyWords = new Map<string, number>();
  const extraWords = new Map<string, number>();
  for (let day = 0; day < days; day++) {
    const date = addDays(from, day);
    const puzzle = generateTermoFromSpec(getTermoDailyInfo(date, language).spec);
    audit(puzzle.seed, validateTermoPuzzle(puzzle).problems);
    for (const word of puzzle.answers) dailyWords.set(word, (dailyWords.get(word) ?? 0) + 1);
    // The day's Dueto and Quarteto: valid on their own, and no word in common with each other or with the daily.
    const ofTheDay = [...puzzle.answers];
    for (const variant of ["dueto", "quarteto"] as const) {
      const extra = generateTermoFromSpec(termoDailyVariantSpec(date, variant, language));
      audit(extra.seed, validateTermoPuzzle(extra).problems);
      ofTheDay.push(...extra.answers);
      for (const word of extra.answers) extraWords.set(word, (extraWords.get(word) ?? 0) + 1);
    }
    if (new Set(ofTheDay).size !== ofTheDay.length) failures.push(`${date}: the puzzles of the day share a word.`);
  }
  const repeats = [...dailyWords.values()].filter((times) => times > 1).length;
  const extraRepeats = [...extraWords.values()].filter((times) => times > 1).length;

  console.log(`${language}`);
  console.log(`  word lists   ${answers.length} answers (${easyPoolSize(language)} in the easy pool), ${knownWordCount(language)} accepted guesses`);
  console.log(`  checked      ${checked} puzzles, ${failures.length} problems`);
  console.log(`  daily words  ${dailyWords.size} different words in ${days} days, ${repeats} used more than once`);
  console.log(`  dueto and quarteto of the day  ${extraWords.size} different words in ${days} days, ${extraRepeats} used more than once`);
  for (const failure of failures.slice(0, 20)) console.log(`    ${failure}`);
  return failures;
}

let failed = 0;
for (const language of languagesFromArgs(args)) failed += validateLanguage(language).length;
if (failed > 0) process.exit(1);
