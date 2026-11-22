/**
 * npm run queens:generate -- --seed 12345 --difficulty hard [--size 8] [--json] [--solution] [--steps]
 */
import { buildTopology, deduce, generateQueensFromSpec, queensSeeds } from "@/games/queens/engine";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";
import { renderQueens } from "./render";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}

const spec = queensSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty, size: typeof args.size === "string" ? args.size : null });
const started = performance.now();
const puzzle = generateQueensFromSpec(spec);
const elapsed = performance.now() - started;

if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
} else {
  const { metadata } = puzzle;
  console.log(`seed        ${puzzle.seed}`);
  console.log(`id          ${puzzle.id}`);
  console.log(`board       ${puzzle.size}x${puzzle.size}, region sizes ${metadata.regionSizes.join(" ")}`);
  console.log(`deduction   ${metadata.steps} steps, hardest level ${metadata.maxLevel}, score ${metadata.score}, per level ${metadata.levels.join("/")}`);
  console.log(`generated   in ${elapsed.toFixed(1)} ms, attempt ${metadata.attempts}, ${metadata.solverNodes} solver nodes`);
  console.log(`\n${renderQueens(puzzle, Boolean(args.solution))}`);
  console.log("\nLegend: one letter per region" + (args.solution ? ", * marks a queen" : ""));
  if (args.steps) {
    const topology = buildTopology(puzzle);
    const name = (cell: number) => `r${Math.floor(cell / puzzle.size) + 1}c${(cell % puzzle.size) + 1}`;
    console.log("");
    deduce(topology).steps.forEach((step, index) => {
      const units = step.units.map((unit) => `${topology.units[unit].kind} ${topology.units[unit].kind === "region" ? String.fromCharCode(65 + topology.units[unit].index) : topology.units[unit].index + 1}`).join(", ");
      const action = step.place !== null ? `queen on ${name(step.place)}` : `rule out ${step.eliminate.map(name).join(" ")}`;
      console.log(`${String(index + 1).padStart(3)}. L${step.level} ${step.technique.padEnd(15)} ${units.padEnd(24)} ${action}`);
    });
  }
}
