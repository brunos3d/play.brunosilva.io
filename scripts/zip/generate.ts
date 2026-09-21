/**
 * npm run zip:generate -- --seed 12345 --difficulty hard [--size 8] [--json] [--solution]
 */
import { generateZipFromSpec, zipSeeds } from "@/games/zip/engine";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";
import { renderZip } from "./render";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}

const spec = zipSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty, size: typeof args.size === "string" ? args.size : null });
const started = performance.now();
const puzzle = generateZipFromSpec(spec);
const elapsed = performance.now() - started;

if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
} else {
  console.log(`seed        ${puzzle.seed}`);
  console.log(`id          ${puzzle.id}`);
  console.log(`board       ${puzzle.width}x${puzzle.height}, ${puzzle.checkpoints.length} numbers, ${puzzle.walls.length} walls`);
  console.log(`generated   in ${elapsed.toFixed(1)} ms, attempt ${puzzle.metadata.attempts}, ${puzzle.metadata.solverNodes} solver nodes`);
  console.log(`\n${renderZip(puzzle, Boolean(args.solution))}`);
  console.log("\nLegend: numbers are checkpoints, | and -- are walls" + (args.solution ? ", small numbers are the order of the path" : ""));
}
