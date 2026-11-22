/**
 * npm run queens:benchmark -- [--count 300] [--size 8]
 * Generates `count` boards per tier and reports speed, shape and the deduction profile.
 */
import { DIFFICULTIES, type Difficulty, MAX_LEVEL, generateQueensPuzzle, validateQueensPuzzle } from "@/games/queens/engine";
import { hashHex } from "@/shared/engine/prng";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 300);
const size = args.size !== undefined ? Number(args.size) : undefined;

function runTier(difficulty: Difficulty): number {
  const ms: number[] = [];
  const boards = new Set<string>();
  const sizes = new Map<number, number>();
  const hardest = new Array<number>(MAX_LEVEL).fill(0);
  const scores: number[] = [];
  let invalid = 0, attempts = 0, steps = 0, smallest = 0, largest = 0;

  for (let i = 0; i < count; i++) {
    const started = performance.now();
    const puzzle = generateQueensPuzzle(`benchmark-${i}`, difficulty, size ? { size } : {});
    ms.push(performance.now() - started);
    if (!validateQueensPuzzle(puzzle).ok) invalid++;
    boards.add(hashHex(`${puzzle.size}|${puzzle.regions.join(",")}`));
    sizes.set(puzzle.size, (sizes.get(puzzle.size) ?? 0) + 1);
    hardest[puzzle.metadata.maxLevel - 1]++;
    scores.push(puzzle.metadata.score);
    attempts += puzzle.metadata.attempts;
    steps += puzzle.metadata.steps;
    smallest += Math.min(...puzzle.metadata.regionSizes);
    largest += Math.max(...puzzle.metadata.regionSizes);
  }
  ms.sort((a, b) => a - b);
  scores.sort((a, b) => a - b);
  const mean = ms.reduce((sum, value) => sum + value, 0) / count;
  const fmt = (value: number) => value.toFixed(2);
  console.log(`\n${difficulty.toUpperCase()}  (${count} boards${size ? `, ${size}x${size}` : ""})`);
  console.log(`  generation ms   mean ${fmt(mean)}  p50 ${fmt(percentile(ms, 0.5))}  p95 ${fmt(percentile(ms, 0.95))}  max ${fmt(ms[count - 1])}`);
  console.log(`  invalid         ${invalid}   mean attempts ${fmt(attempts / count)}`);
  console.log(`  duplicates      ${count - boards.size}`);
  console.log(`  boards          ${[...sizes].sort().map(([n, c]) => `${n}x${n}: ${c}`).join(", ")}`);
  console.log(`  regions         smallest ${fmt(smallest / count)} cells  largest ${fmt(largest / count)} cells`);
  console.log(`  deduction       ${fmt(steps / count)} steps  hardest level 1..${MAX_LEVEL}: ${hardest.join(" / ")}`);
  console.log(`  score           mean ${fmt(scores.reduce((sum, value) => sum + value, 0) / count)}  p10 ${percentile(scores, 0.1)}  p50 ${percentile(scores, 0.5)}  p90 ${percentile(scores, 0.9)}`);
  return invalid;
}

let invalid = 0;
for (const difficulty of DIFFICULTIES) invalid += runTier(difficulty);
if (invalid > 0) {
  console.error(`\n${invalid} invalid boards`);
  process.exit(1);
}
