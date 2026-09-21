/**
 * npm run patches:validate -- [--count 200] [--from 2026-03-18 --days 365]
 * Audits random seeds for every tier and size, plus a run of daily puzzles.
 * Exits non-zero if any puzzle has a problem.
 */
import { DIFFICULTIES, MAX_BOARD_SIZE, MIN_BOARD_SIZE, addDays, generatePuzzle, getDailyPuzzle, validatePuzzle } from "@/games/patches/engine";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 200);
const from = typeof args.from === "string" ? args.from : "2026-03-18";
const days = Number(args.days ?? 365);

let checked = 0;
const failures: string[] = [];
const audit = (label: string, problems: string[]) => {
  checked++;
  if (problems.length > 0) failures.push(`${label}: ${problems.join(" ")}`);
};

for (const difficulty of DIFFICULTIES) {
  for (let i = 0; i < count; i++) {
    const puzzle = generatePuzzle(`validate-${i}`, difficulty);
    audit(puzzle.seed, validatePuzzle(puzzle).problems);
  }
  for (let size = MIN_BOARD_SIZE; size <= MAX_BOARD_SIZE; size++) {
    for (let i = 0; i < Math.ceil(count / 20); i++) {
      const puzzle = generatePuzzle(`validate-size-${i}`, difficulty, { size });
      audit(puzzle.seed, validatePuzzle(puzzle).problems);
    }
  }
}
for (let day = 0; day < days; day++) {
  const { puzzle } = getDailyPuzzle(addDays(from, day));
  audit(puzzle.seed, validatePuzzle(puzzle).problems);
}

console.log(`checked ${checked} puzzles, ${failures.length} with problems`);
for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
if (failures.length > 0) process.exit(1);
