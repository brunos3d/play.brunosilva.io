/**
 * npm run sumbreak:generate -- --seed 12345 --difficulty hard [--size 4] [--json] [--solution]
 */
import { generateSumbreakFromSpec, sumbreakSeeds, validateSumbreakPuzzle } from "@/games/sumbreak/engine";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";
import { renderSumbreak } from "./render";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}

const spec = sumbreakSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty, size: typeof args.size === "string" ? args.size : null });
const started = performance.now();
const puzzle = generateSumbreakFromSpec(spec);
const elapsed = performance.now() - started;

if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
} else {
  const check = validateSumbreakPuzzle(puzzle);
  const place = (cell: number) => `r${Math.floor(cell / puzzle.size) + 1}c${(cell % puzzle.size) + 1}`;
  console.log(`seed        ${puzzle.seed}`);
  console.log(`id          ${puzzle.id}`);
  console.log(`board       ${puzzle.size}x${puzzle.size}, last tile ${puzzle.total}, ${puzzle.metadata.openingMoves} opening merges`);
  console.log(`difficulty  ${puzzle.difficulty}, win chance ${puzzle.metadata.winChance.toFixed(4)}`);
  console.log(`generated   in ${elapsed.toFixed(1)} ms, candidate ${puzzle.metadata.attempts}, ${puzzle.metadata.solverNodes} solver nodes`);
  console.log(`validator   ${check.ok ? "ok" : check.problems.join(" ")}`);
  console.log(`\n${renderSumbreak(puzzle)}`);
  if (args.solution) console.log(`\nsolution    ${puzzle.solution.map((merge) => `${place(merge.from)}>${place(merge.to)}`).join(" ")}`);
}
