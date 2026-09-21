/**
 * npm run patches:benchmark -- [--count 1000] [--size 10]
 * Generates `count` puzzles per tier and reports speed and quality. Without
 * --count it runs the 100, 500 and 1000 series back to back.
 */
import { DIFFICULTIES, type Difficulty, generatePuzzle, hasShapeRule, hashHex, regionRect, solve, validatePuzzle } from "@/games/patches/engine";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const series = args.count !== undefined ? [Number(args.count)] : [100, 500, 1000];
const size = args.size !== undefined ? Number(args.size) : undefined;

const BUCKET_WIDTH = 10;

function runTier(difficulty: Difficulty, count: number) {
  const generationMs: number[] = [];
  const solverMs: number[] = [];
  const scores: number[] = [];
  const exact = new Set<string>();
  const layouts = new Set<string>();
  const solutionCounts = new Map<number, number>();
  const sizes = new Map<number, number>();
  const kinds = { both: 0, numberOnly: 0, shapeOnly: 0, neither: 0 };
  let noShapeIconBoards = 0;
  let invalid = 0, inTier = 0, attempts = 0, clues = 0, unknown = 0, opening = 0, lookahead = 0;

  for (let i = 0; i < count; i++) {
    const startedGeneration = performance.now();
    const puzzle = generatePuzzle(`benchmark-${count}-${i}`, difficulty, size ? { size } : {});
    generationMs.push(performance.now() - startedGeneration);

    const startedSolve = performance.now();
    const solved = solve(puzzle, { maxSolutions: 2 });
    solverMs.push(performance.now() - startedSolve);

    solutionCounts.set(solved.solutionCount, (solutionCounts.get(solved.solutionCount) ?? 0) + 1);
    if (!validatePuzzle(puzzle).ok) invalid++;
    if (puzzle.metadata.measuredDifficulty === difficulty) inTier++;

    const layout = JSON.stringify(puzzle.solution.map(regionRect));
    layouts.add(hashHex(`${puzzle.width}|${layout}`));
    exact.add(hashHex(`${puzzle.width}|${layout}|${JSON.stringify(puzzle.clues)}`));

    let shapeIcons = 0;
    for (const clue of puzzle.clues) {
      const numbered = clue.area !== undefined;
      const shaped = hasShapeRule(clue);
      if (shaped) shapeIcons++;
      kinds[numbered ? (shaped ? "both" : "numberOnly") : shaped ? "shapeOnly" : "neither"]++;
    }
    if (shapeIcons === 0) noShapeIconBoards++;

    scores.push(puzzle.metadata.difficultyScore);
    sizes.set(puzzle.width, (sizes.get(puzzle.width) ?? 0) + 1);
    attempts += puzzle.metadata.attempts;
    clues += puzzle.clues.length;
    unknown += puzzle.metadata.metrics.unknownClueRatio;
    opening += puzzle.metadata.metrics.forcedMoveCount / puzzle.clues.length;
    lookahead += puzzle.metadata.metrics.advancedStepCount;
  }

  generationMs.sort((a, b) => a - b);
  solverMs.sort((a, b) => a - b);
  const histogram = new Map<number, number>();
  for (const score of scores) {
    const bucket = Math.floor(score / BUCKET_WIDTH) * BUCKET_WIDTH;
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const fmt = (value: number) => value.toFixed(2);

  console.log(`\n${difficulty.toUpperCase()}  (${count} puzzles${size ? `, ${size}x${size}` : ""})`);
  console.log(`  generation ms   mean ${fmt(mean(generationMs))}  p50 ${fmt(percentile(generationMs, 0.5))}  p95 ${fmt(percentile(generationMs, 0.95))}  max ${fmt(generationMs[generationMs.length - 1])}`);
  console.log(`  solver ms       mean ${fmt(mean(solverMs))}  p95 ${fmt(percentile(solverMs, 0.95))}  max ${fmt(solverMs[solverMs.length - 1])}`);
  console.log(`  solutions       ${[...solutionCounts].sort().map(([n, c]) => `${n}: ${c}`).join(", ")}`);
  console.log(`  invalid         ${invalid} (${fmt((invalid / count) * 100)}%)`);
  console.log(`  in tier         ${fmt((inTier / count) * 100)}%   mean attempts ${fmt(attempts / count)}`);
  console.log(`  duplicates      exact ${count - exact.size} (${fmt(((count - exact.size) / count) * 100)}%), same layout ${count - layouts.size} (${fmt(((count - layouts.size) / count) * 100)}%)`);
  console.log(`  boards          ${[...sizes].sort().map(([n, c]) => `${n}x${n}: ${c}`).join(", ")}   mean clues ${fmt(clues / count)}`);
  console.log(`  clue info       numberless ${fmt((unknown / count) * 100)}%   forced on empty board ${fmt((opening / count) * 100)}%   lookahead steps/puzzle ${fmt(lookahead / count)}`);
  console.log(`  clue kinds      ${Object.entries(kinds).map(([kind, n]) => `${kind} ${fmt((n / clues) * 100)}%`).join("  ")}   boards with no shape icon ${fmt((noShapeIconBoards / count) * 100)}%`);
  console.log(`  score           mean ${fmt(mean(scores))}  min ${fmt(Math.min(...scores))}  max ${fmt(Math.max(...scores))}`);
  console.log(`  distribution    ${[...histogram].sort((a, b) => a[0] - b[0]).map(([bucket, c]) => `${bucket}-${bucket + BUCKET_WIDTH}: ${c}`).join("  ")}`);
  return invalid;
}

let totalInvalid = 0;
for (const count of series) {
  console.log(`\n=== ${count} puzzles per tier ===`);
  for (const difficulty of DIFFICULTIES) totalInvalid += runTier(difficulty, count);
}
if (totalInvalid > 0) {
  console.error(`\n${totalInvalid} invalid puzzles`);
  process.exit(1);
}
