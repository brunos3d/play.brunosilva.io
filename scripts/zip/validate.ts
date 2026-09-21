/**
 * npm run zip:validate -- [--count 100] [--from 2025-03-18 --days 365]
 * Audits random seeds for every tier and size, plus a run of daily puzzles.
 * Exits non-zero if any puzzle has a problem.
 */
import { DIFFICULTIES, generateZipPuzzle, getZipDailyPuzzle, validateZipPuzzle, zipSeeds } from "@/games/zip/engine";
import { addDays } from "@/shared/engine/pacific-time";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 100);
const from = typeof args.from === "string" ? args.from : "2025-03-18";
const days = Number(args.days ?? 365);

let checked = 0;
const failures: string[] = [];
const audit = (label: string, problems: string[]) => {
  checked++;
  if (problems.length > 0) failures.push(`${label}: ${problems.join(" ")}`);
};

for (const difficulty of DIFFICULTIES) {
  for (let i = 0; i < count; i++) {
    const puzzle = generateZipPuzzle(`validate-${i}`, difficulty);
    audit(puzzle.seed, validateZipPuzzle(puzzle).problems);
  }
  for (let size = zipSeeds.minSize; size <= zipSeeds.maxSize; size++) {
    for (let i = 0; i < Math.ceil(count / 10); i++) {
      const puzzle = generateZipPuzzle(`validate-size-${i}`, difficulty, { size });
      audit(puzzle.seed, validateZipPuzzle(puzzle).problems);
    }
  }
}
for (let day = 0; day < days; day++) {
  const { puzzle } = getZipDailyPuzzle(addDays(from, day));
  audit(puzzle.seed, validateZipPuzzle(puzzle).problems);
}

console.log(`checked ${checked} puzzles, ${failures.length} with problems`);
for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
if (failures.length > 0) process.exit(1);
