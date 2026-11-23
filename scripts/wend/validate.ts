/**
 * npm run wend:validate -- [--count 100] [--from 2026-06-09 --days 365]
 * Audits random seeds for every tier and every board size, plus a run of daily
 * puzzles, and confirms that a seed builds the same board twice. Exits non-zero
 * if any puzzle has a problem.
 */
import { DIFFICULTIES, WEND_MAX_SIZE, WEND_MIN_SIZE, generateWendPuzzle, getWendDailyPuzzle, validateWendPuzzle } from "@/games/wend/engine";
import type { WendPuzzle } from "@/games/wend/engine";
import { addDays } from "@/shared/engine/pacific-time";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 100);
const from = typeof args.from === "string" ? args.from : "2026-06-09";
const days = Number(args.days ?? 365);

let checked = 0;
const failures: string[] = [];
const audit = (puzzle: WendPuzzle, again: WendPuzzle) => {
  checked++;
  const problems = validateWendPuzzle(puzzle).problems;
  if (again.letters.join("|") !== puzzle.letters.join("|") || again.theme !== puzzle.theme) problems.push("The seed did not rebuild the same board.");
  if (problems.length > 0) failures.push(`${puzzle.seed}: ${problems.join(" ")}`);
};

for (const difficulty of DIFFICULTIES) {
  for (let index = 0; index < count; index++) audit(generateWendPuzzle(`validate-${index}`, difficulty), generateWendPuzzle(`validate-${index}`, difficulty));
  // Sizes picked by hand, including ones the tier would never choose.
  for (let size = WEND_MIN_SIZE; size <= WEND_MAX_SIZE; size++) {
    for (let index = 0; index < Math.ceil(count / 10); index++) audit(generateWendPuzzle(`sized-${index}`, difficulty, { size }), generateWendPuzzle(`sized-${index}`, difficulty, { size }));
  }
}

const themes = new Map<string, number[]>();
let closest = Infinity;
for (let day = 0; day < days; day++) {
  const { puzzle } = getWendDailyPuzzle(addDays(from, day));
  audit(puzzle, getWendDailyPuzzle(addDays(from, day)).puzzle);
  const seen = themes.get(puzzle.theme) ?? [];
  if (seen.length > 0) closest = Math.min(closest, day - seen[seen.length - 1]);
  themes.set(puzzle.theme, [...seen, day]);
}

console.log(`checked      ${checked} puzzles, ${failures.length} with problems`);
console.log(`daily themes ${themes.size} themes in ${days} days from ${from}, the same theme never closer than ${Number.isFinite(closest) ? closest : days} days apart`);
for (const failure of failures.slice(0, 20)) console.log(`FAIL ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
