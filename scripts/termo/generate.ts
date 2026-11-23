/**
 * npm run termo:generate -- --seed 12345 --difficulty hard [--json] [--solution]
 * The hidden words stay hidden unless --solution or --json is given.
 */
import { displayWord, generateTermoFromSpec, knownWordCount, termoSeeds, validateTermoPuzzle } from "@/games/termo/engine";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}

const spec = termoSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty });
const started = performance.now();
const puzzle = generateTermoFromSpec(spec);
const elapsed = performance.now() - started;

if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
} else {
  const check = validateTermoPuzzle(puzzle);
  console.log(`seed        ${puzzle.seed}`);
  console.log(`id          ${puzzle.id}`);
  console.log(`difficulty  ${puzzle.difficulty}: ${puzzle.answers.length} word(s), ${puzzle.maxGuesses} guesses`);
  console.log(`pool        ${puzzle.metadata.poolSize} answers, ${knownWordCount()} accepted guesses`);
  console.log(`generated   in ${elapsed.toFixed(2)} ms`);
  console.log(`validator   ${check.ok ? "ok" : check.problems.join(" ")}`);
  console.log(`words       ${args.solution ? puzzle.answers.map((word, index) => `${displayWord(word)} (#${puzzle.metadata.ranks[index] + 1})`).join(", ") : "hidden, pass --solution to print them"}`);
}
