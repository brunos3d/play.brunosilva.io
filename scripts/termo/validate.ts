/**
 * npm run termo:validate -- [--count 200] [--from 2026-11-22 --days 365]
 * Audits the word lists, random seeds for every tier and a run of daily puzzles.
 * Exits non-zero if anything has a problem.
 */
import { DIFFICULTIES, EASY_POOL_SIZE, WORD_LENGTH, answerWords, displayWord, generateTermoFromSpec, generateTermoPuzzle, getTermoDailyInfo, isKnownWord, knownWordCount, plainLetters, termoDailyVariantSpec, validateTermoPuzzle } from "@/games/termo/engine";
import { addDays } from "@/shared/engine/pacific-time";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 200);
const from = typeof args.from === "string" ? args.from : "2026-11-22";
const days = Number(args.days ?? 365);

const failures: string[] = [];

// The lists themselves.
const answers = answerWords();
if (new Set(answers).size !== answers.length) failures.push("The answer list repeats a word.");
if (EASY_POOL_SIZE > answers.length) failures.push("The easy pool is larger than the answer list.");
for (const word of answers) {
  if (!new RegExp(`^[a-z]{${WORD_LENGTH}}$`).test(word)) failures.push(`answer "${word}" is not five plain letters`);
  if (!isKnownWord(word)) failures.push(`answer "${word}" cannot be typed as a guess`);
  const shown = displayWord(word);
  if ([...shown].length !== WORD_LENGTH || plainLetters(shown) !== word) failures.push(`answer "${word}" is shown as "${shown}"`);
}

let checked = 0;
const audit = (label: string, problems: string[]) => {
  checked++;
  if (problems.length > 0) failures.push(`${label}: ${problems.join(" ")}`);
};

for (const difficulty of DIFFICULTIES) {
  for (let i = 0; i < count; i++) {
    const puzzle = generateTermoPuzzle(`validate-${i}`, difficulty);
    audit(puzzle.seed, validateTermoPuzzle(puzzle).problems);
  }
}
const dailyWords = new Map<string, number>();
const extraWords = new Map<string, number>();
for (let day = 0; day < days; day++) {
  const date = addDays(from, day);
  const puzzle = generateTermoFromSpec(getTermoDailyInfo(date).spec);
  audit(puzzle.seed, validateTermoPuzzle(puzzle).problems);
  for (const word of puzzle.answers) dailyWords.set(word, (dailyWords.get(word) ?? 0) + 1);
  // The day's Dueto and Quarteto: valid on their own, and no word in common with each other or with the daily.
  const ofTheDay = [...puzzle.answers];
  for (const variant of ["dueto", "quarteto"] as const) {
    const extra = generateTermoFromSpec(termoDailyVariantSpec(date, variant));
    audit(extra.seed, validateTermoPuzzle(extra).problems);
    ofTheDay.push(...extra.answers);
    for (const word of extra.answers) extraWords.set(word, (extraWords.get(word) ?? 0) + 1);
  }
  if (new Set(ofTheDay).size !== ofTheDay.length) failures.push(`${date}: the puzzles of the day share a word.`);
}
const repeats = [...dailyWords.values()].filter((times) => times > 1).length;
const extraRepeats = [...extraWords.values()].filter((times) => times > 1).length;

console.log(`word lists   ${answers.length} answers (${EASY_POOL_SIZE} in the easy pool), ${knownWordCount()} accepted guesses`);
console.log(`checked      ${checked} puzzles, ${failures.length} problems`);
console.log(`daily words  ${dailyWords.size} different words in ${days} days, ${repeats} used more than once`);
console.log(`dueto and quarteto of the day  ${extraWords.size} different words in ${days} days, ${extraRepeats} used more than once`);
for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
if (failures.length > 0) process.exit(1);
