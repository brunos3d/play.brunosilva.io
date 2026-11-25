/**
 * npm run wend:generate -- --seed 12345 --difficulty hard [--size 7] [--lang en] [--solution] [--json]
 * npm run wend:generate -- --date 2026-11-23 [--lang en] [--solution]
 * The words are Portuguese unless --lang says otherwise. A canonical seed
 * given to --seed keeps the language it names.
 */
import { generateWendFromSpec, getWendDailyPuzzle, validateWendPuzzle, wendSeeds } from "@/games/wend/engine";
import type { WendPuzzle } from "@/games/wend/engine";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";
import { languageArg } from "./language";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}

const language = languageArg(args.lang);

function build(): WendPuzzle {
  if (typeof args.date === "string") return getWendDailyPuzzle(args.date, language).puzzle;
  return generateWendFromSpec(wendSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty, size: typeof args.size === "string" ? args.size : null, lang: language }));
}

const started = performance.now();
const puzzle = build();
const elapsed = performance.now() - started;
if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
  process.exit(0);
}
const check = validateWendPuzzle(puzzle);

console.log(`seed        ${puzzle.seed}`);
console.log(`id          ${puzzle.id}`);
console.log(`language    ${puzzle.language}`);
console.log(`board       ${puzzle.size}x${puzzle.size}, ${puzzle.metadata.walls} walls, ${puzzle.words.length} words`);
console.log(`theme       ${puzzle.theme}${puzzle.themeShown ? "" : " (hidden until the first word is found)"}`);
console.log(`lengths     ${puzzle.words.map((word) => word.text.length).join(", ")}`);
console.log(`generation  ${elapsed.toFixed(1)} ms, try ${puzzle.metadata.attempts}, ${puzzle.metadata.solverNodes} solver nodes`);
console.log(`validator   ${check.ok ? "ok" : check.problems.join(" ")}`);
console.log("");
for (let row = 0; row < puzzle.size; row++) {
  console.log(
    "  " +
      puzzle.letters
        .slice(row * puzzle.size, (row + 1) * puzzle.size)
        .map((letter) => letter || "#")
        .join(" "),
  );
}
if (args.solution) {
  const place = (cell: number) => `r${Math.floor(cell / puzzle.size) + 1}c${(cell % puzzle.size) + 1}`;
  console.log("");
  for (const word of puzzle.words) console.log(`  ${word.display.padEnd(13)} ${word.path.map(place).join(" ")}`);
}
