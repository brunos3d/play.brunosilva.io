/**
 * npm run chess:generate -- --seed 12345 --difficulty hard [--json] [--solution] [--lang pt-br]
 *
 * `--lang` is the language of the coach's lines: en (default) or pt-br.
 */
import { Position, chessSeeds, coachFor, generateChessFromSpec, lineToSan, positionAfter, resolvePuzzle, toSan, validateChessPuzzle } from "@/games/chess/engine";
import { isGameLanguage } from "@/i18n/game-language";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";
import { renderPosition } from "./render";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
if (!isDifficulty(difficulty)) {
  console.error(`Unknown difficulty "${difficulty}". Use easy, medium, hard or expert.`);
  process.exit(1);
}
const language = typeof args.lang === "string" ? args.lang : "en";
if (!isGameLanguage(language)) {
  console.error(`Unknown language "${language}". Use en or pt-br.`);
  process.exit(1);
}

const spec = chessSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty });
const started = performance.now();
const puzzle = generateChessFromSpec(spec);
const elapsed = performance.now() - started;

if (args.json) {
  console.log(JSON.stringify(puzzle, null, 2));
} else {
  const resolved = resolvePuzzle(puzzle);
  const check = validateChessPuzzle(puzzle);
  console.log(`seed        ${puzzle.seed}`);
  console.log(`id          ${puzzle.id}`);
  console.log(`puzzle      ${puzzle.metadata.recipe}: ${puzzle.kind}${puzzle.mateIn ? ` in ${puzzle.mateIn}` : ""}, ${puzzle.solver} to move, themes ${puzzle.themes.join(", ") || "none"}`);
  console.log(`mined       game ${puzzle.metadata.games}, half-move ${puzzle.metadata.ply}, ${puzzle.metadata.pieces} pieces`);
  console.log(`generated   in ${elapsed.toFixed(1)} ms, ${puzzle.metadata.nodes} search nodes`);
  console.log(`validator   ${check.ok ? "ok" : check.errors.join("; ")}`);
  console.log(`start       ${puzzle.fen}`);
  console.log(`opening     ${toSan(Position.fromFen(puzzle.fen), resolved.setup)}`);
  console.log(`\n${renderPosition(positionAfter(resolved, []))}`);
  const coach = coachFor(language);
  console.log(`\ncoach       ${coach.intro(resolved).text}`);
  if (args.solution) {
    console.log(`solution    ${lineToSan(positionAfter(resolved, []), resolved.line)}`);
    console.log(`in words    ${coach.reveal(resolved).text}`);
  }
}
