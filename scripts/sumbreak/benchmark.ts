/**
 * npm run sumbreak:benchmark -- [--count 300] [--size 4]
 * Generates `count` boards per tier and reports speed, sizes and the spread of the difficulty measure.
 */
import { DIFFICULTIES, type Difficulty, generateSumbreakPuzzle, validateSumbreakPuzzle } from "@/games/sumbreak/engine";
import { hashHex } from "@/shared/engine/prng";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 300);
const size = args.size !== undefined ? Number(args.size) : undefined;

function runTier(difficulty: Difficulty): number {
  const ms: number[] = [];
  const chances: number[] = [];
  const boards = new Set<string>();
  const sizes = new Map<number, number>();
  const totals = new Map<number, number>();
  let invalid = 0, openings = 0, attempts = 0;

  for (let i = 0; i < count; i++) {
    const started = performance.now();
    const puzzle = generateSumbreakPuzzle(`benchmark-${i}`, difficulty, size ? { size } : {});
    ms.push(performance.now() - started);
    if (!validateSumbreakPuzzle(puzzle).ok) invalid++;
    boards.add(hashHex(`${puzzle.size}|${puzzle.cells.join(",")}`));
    sizes.set(puzzle.size, (sizes.get(puzzle.size) ?? 0) + 1);
    totals.set(puzzle.total, (totals.get(puzzle.total) ?? 0) + 1);
    chances.push(puzzle.metadata.winChance);
    openings += puzzle.metadata.openingMoves;
    attempts += puzzle.metadata.attempts;
  }
  ms.sort((a, b) => a - b);
  chances.sort((a, b) => a - b);
  const mean = ms.reduce((sum, value) => sum + value, 0) / count;
  const fmt = (value: number) => value.toFixed(2);
  const chance = (fraction: number) => percentile(chances, fraction).toFixed(3);
  console.log(`\n${difficulty.toUpperCase()}  (${count} boards${size ? `, ${size}x${size}` : ""})`);
  console.log(`  generation ms   mean ${fmt(mean)}  p50 ${fmt(percentile(ms, 0.5))}  p95 ${fmt(percentile(ms, 0.95))}  max ${fmt(ms[count - 1])}`);
  console.log(`  invalid         ${invalid}   duplicates ${count - boards.size}   mean candidates ${fmt(attempts / count)}`);
  console.log(`  boards          ${[...sizes].sort().map(([n, c]) => `${n}x${n}: ${c}`).join(", ")}`);
  console.log(`  last tile       ${[...totals].sort((a, b) => a[0] - b[0]).map(([total, c]) => `${total}: ${c}`).join(", ")}`);
  console.log(`  win chance      p10 ${chance(0.1)}  p50 ${chance(0.5)}  p90 ${chance(0.9)}   opening merges ${fmt(openings / count)}`);
  return invalid;
}

let invalid = 0;
for (const difficulty of DIFFICULTIES) invalid += runTier(difficulty);
if (invalid > 0) {
  console.error(`\n${invalid} invalid boards`);
  process.exit(1);
}
