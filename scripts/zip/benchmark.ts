/**
 * npm run zip:benchmark -- [--count 300] [--size 8]
 * Generates `count` boards per tier and reports speed and shape.
 */
import { DIFFICULTIES, type Difficulty, generateZipPuzzle, validateZipPuzzle } from "@/games/zip/engine";
import { hashHex } from "@/shared/engine/prng";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 300);
const size = args.size !== undefined ? Number(args.size) : undefined;

function runTier(difficulty: Difficulty): number {
  const ms: number[] = [];
  const paths = new Set<string>();
  const sizes = new Map<number, number>();
  let invalid = 0, walls = 0, numbers = 0, attempts = 0, turns = 0, cells = 0;

  for (let i = 0; i < count; i++) {
    const started = performance.now();
    const puzzle = generateZipPuzzle(`benchmark-${i}`, difficulty, size ? { size } : {});
    ms.push(performance.now() - started);
    if (!validateZipPuzzle(puzzle).ok) invalid++;
    paths.add(hashHex(`${puzzle.width}|${puzzle.solution.join(",")}`));
    sizes.set(puzzle.width, (sizes.get(puzzle.width) ?? 0) + 1);
    walls += puzzle.walls.length;
    numbers += puzzle.checkpoints.length;
    attempts += puzzle.metadata.attempts;
    cells += puzzle.solution.length;
    for (let step = 2; step < puzzle.solution.length; step++) {
      if (puzzle.solution[step] - puzzle.solution[step - 1] !== puzzle.solution[step - 1] - puzzle.solution[step - 2]) turns++;
    }
  }
  ms.sort((a, b) => a - b);
  const mean = ms.reduce((sum, value) => sum + value, 0) / count;
  const fmt = (value: number) => value.toFixed(2);
  console.log(`\n${difficulty.toUpperCase()}  (${count} boards${size ? `, ${size}x${size}` : ""})`);
  console.log(`  generation ms   mean ${fmt(mean)}  p50 ${fmt(percentile(ms, 0.5))}  p95 ${fmt(percentile(ms, 0.95))}  max ${fmt(ms[count - 1])}`);
  console.log(`  invalid         ${invalid}   mean attempts ${fmt(attempts / count)}`);
  console.log(`  duplicates      ${count - paths.size}`);
  console.log(`  boards          ${[...sizes].sort().map(([n, c]) => `${n}x${n}: ${c}`).join(", ")}`);
  console.log(`  shape           numbers ${fmt(numbers / count)}  walls ${fmt(walls / count)}  turns per cell ${fmt(turns / cells)}`);
  return invalid;
}

let invalid = 0;
for (const difficulty of DIFFICULTIES) invalid += runTier(difficulty);
if (invalid > 0) {
  console.error(`\n${invalid} invalid boards`);
  process.exit(1);
}
