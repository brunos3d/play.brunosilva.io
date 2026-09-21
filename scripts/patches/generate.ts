/**
 * npm run patches:generate -- --seed 12345 --difficulty hard [--size 8] [--json] [--solution]
 */
import { type Difficulty, generateFromSpec, isDifficulty, resolveSpec } from "@/games/patches/engine";
import { parseArgs } from "../shared/cli";
import { renderClues, renderSolution } from "./render";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}

const spec = resolveSpec({
  seed: typeof args.seed === "string" ? args.seed : "1",
  difficulty: difficulty as Difficulty,
  size: typeof args.size === "string" ? args.size : null,
});

const started = performance.now();
const puzzle = generateFromSpec(spec);
const elapsed = performance.now() - started;

if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
} else {
  const { metadata } = puzzle;
  console.log(`seed        ${puzzle.seed}`);
  console.log(`id          ${puzzle.id}`);
  console.log(`board       ${puzzle.width}x${puzzle.height}, ${puzzle.clues.length} clues`);
  console.log(`difficulty  ${puzzle.difficulty} (score ${metadata.difficultyScore}, measured ${metadata.measuredDifficulty})`);
  console.log(`generated   in ${elapsed.toFixed(1)} ms, attempt ${metadata.attempts}`);
  console.log(`metrics     ${JSON.stringify(metadata.metrics)}`);
  console.log(`\n${renderClues(puzzle)}`);
  if (args.solution) console.log(`\n${renderSolution(puzzle)}`);
  console.log("\nLegend: 6w = 6 cells wide, ?t = unknown size tall, s = square, * = any-shape icon");
}
