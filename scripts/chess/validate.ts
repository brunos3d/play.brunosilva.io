/**
 * npm run chess:validate -- [--count 100] [--from 2026-11-22 --days 365]
 * Audits random seeds for every tier, plus a run of daily puzzles. Exits
 * non-zero if any puzzle has a problem.
 */
import { DIFFICULTIES, generateChessPuzzle, getChessDailyPuzzle, validateChessPuzzle } from "@/games/chess/engine";
import { addDays } from "@/shared/engine/pacific-time";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 100);
const from = typeof args.from === "string" ? args.from : "2026-11-22";
const days = Number(args.days ?? 365);

let checked = 0;
const failures: string[] = [];
const audit = (label: string, errors: string[]) => {
  checked++;
  if (errors.length > 0) failures.push(`${label}: ${errors.join("; ")}`);
};

for (const difficulty of DIFFICULTIES) {
  for (let i = 0; i < count; i++) {
    const puzzle = generateChessPuzzle(`validate-${i}`, difficulty);
    audit(puzzle.seed, validateChessPuzzle(puzzle).errors);
  }
}
for (let day = 0; day < days; day++) {
  const { puzzle } = getChessDailyPuzzle(addDays(from, day));
  audit(puzzle.seed, validateChessPuzzle(puzzle).errors);
}

console.log(`checked ${checked} puzzles, ${failures.length} with problems`);
for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
if (failures.length > 0) process.exit(1);
