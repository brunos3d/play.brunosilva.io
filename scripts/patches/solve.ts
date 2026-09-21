/**
 * npm run patches:solve -- --seed 12345 [--difficulty hard] [--size 8] [--steps]
 * Re-solves the puzzle from its clues alone and compares with the stored solution.
 */
import { buildCandidates, describeClue, generateFromSpec, rectEquals, regionRect, resolveSpec, solve, solveWithLogic } from "@/games/patches/engine";
import { parseArgs } from "../shared/cli";
import { renderClues, renderRects } from "./render";

const args = parseArgs(process.argv.slice(2));
const puzzle = generateFromSpec(
  resolveSpec({
    seed: typeof args.seed === "string" ? args.seed : "1",
    difficulty: typeof args.difficulty === "string" ? args.difficulty : null,
    size: typeof args.size === "string" ? args.size : null,
  }),
);

const candidates = buildCandidates(puzzle);
const started = performance.now();
const result = solve(puzzle, { candidates, maxSolutions: 10 });
const elapsed = performance.now() - started;

console.log(`seed       ${puzzle.seed}`);
console.log(`candidates ${candidates.candidates.length} (${candidates.byClue.map((list) => list.length).join(", ")})`);
console.log(`solutions  ${result.solutionCount}${result.solutionCount >= 10 ? "+" : ""} in ${elapsed.toFixed(2)} ms, ${result.nodes} nodes, max branching ${result.maximumBranchingFactor}`);
console.log(`\n${renderClues(puzzle)}`);

if (result.solutionCount > 0) {
  console.log(`\n${renderRects(puzzle.width, puzzle.height, result.solutions[0])}`);
  const agrees = puzzle.solution.every((region, index) => rectEquals(regionRect(region), result.solutions[0][index]));
  console.log(`\nmatches stored solution: ${agrees ? "yes" : "NO"}`);
  if (!agrees || result.solutionCount !== 1) process.exitCode = 1;
} else {
  process.exitCode = 1;
}

if (args.steps) {
  const logic = solveWithLogic(puzzle, { candidates });
  console.log(`\nlogic path: ${logic.waves} rounds, ${logic.eliminatedCandidates} rectangles ruled out by lookahead`);
  for (const step of logic.steps) {
    const rect = candidates.candidates[step.candidateIndex].rect;
    const clue = puzzle.clues[step.clueIndex];
    console.log(
      `  round ${step.wave}  ${step.technique.padEnd(11)} ${step.neededElimination ? "+lookahead " : "           "}` +
        `r${clue.row + 1}c${clue.column + 1} (${describeClue(clue)}) -> ${rect.width}x${rect.height} at r${rect.row + 1}c${rect.column + 1}`,
    );
  }
}
