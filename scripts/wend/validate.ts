/**
 * npm run wend:validate -- [--count 100] [--from 2026-06-09 --days 365] [--lang en]
 * Audits random seeds for every tier and every board size, plus a run of daily
 * puzzles, and confirms that a seed builds the same board twice. Exits non-zero
 * if any puzzle has a problem. The words are Portuguese unless --lang says
 * otherwise.
 */
import { DIFFICULTIES, WEND_BANKS, WEND_MAX_SIZE, WEND_MIN_SIZE, generateWendPuzzle, getWendDailyPuzzle, validateWendPuzzle, wendLanguage, wendSeeds } from "@/games/wend/engine";
import type { WendPuzzle } from "@/games/wend/engine";
import { addDays } from "@/shared/engine/pacific-time";
import { parseArgs } from "../shared/cli";
import { languageArg } from "./language";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 100);
const from = typeof args.from === "string" ? args.from : "2026-06-09";
const days = Number(args.days ?? 365);
const language = languageArg(args.lang);

let checked = 0;
const failures: string[] = [];
const audit = (build: () => WendPuzzle, label: string): WendPuzzle | null => {
  checked++;
  try {
    const puzzle = build();
    const again = build();
    const problems = validateWendPuzzle(puzzle).problems;
    if (again.letters.join("|") !== puzzle.letters.join("|") || again.theme !== puzzle.theme) problems.push("The seed did not rebuild the same board.");
    // The puzzle and its seed must both say the language that was asked for.
    const parsed = wendSeeds.parse(puzzle.seed);
    if (puzzle.language !== language || !parsed || wendLanguage(parsed) !== language) problems.push(`The puzzle is not in ${language}.`);
    if (problems.length > 0) failures.push(`${puzzle.seed}: ${problems.join(" ")}`);
    return puzzle;
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

for (const difficulty of DIFFICULTIES) {
  for (let index = 0; index < count; index++) audit(() => generateWendPuzzle(`validate-${index}`, difficulty, { language }), `validate-${index} ${difficulty}`);
  // Sizes picked by hand, including ones the tier would never choose.
  for (let size = WEND_MIN_SIZE; size <= WEND_MAX_SIZE; size++) {
    for (let index = 0; index < Math.ceil(count / 10); index++) audit(() => generateWendPuzzle(`sized-${index}`, difficulty, { size, language }), `sized-${index} ${difficulty} ${size}`);
  }
}

const themes = new Map<string, number[]>();
let closest = Infinity;
for (let day = 0; day < days; day++) {
  const date = addDays(from, day);
  const puzzle = audit(() => getWendDailyPuzzle(date, language).puzzle, `daily ${date}`);
  if (!puzzle) continue;
  const seen = themes.get(puzzle.theme) ?? [];
  if (seen.length > 0) closest = Math.min(closest, day - seen[seen.length - 1]);
  themes.set(puzzle.theme, [...seen, day]);
}

console.log(`language     ${language}, ${WEND_BANKS[language].length} themes`);
console.log(`checked      ${checked} puzzles, ${failures.length} with problems`);
console.log(`daily themes ${themes.size} themes in ${days} days from ${from}, the same theme never closer than ${Number.isFinite(closest) ? closest : days} days apart`);
for (const failure of failures.slice(0, 20)) console.log(`FAIL ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
