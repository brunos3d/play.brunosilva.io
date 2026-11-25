/**
 * npx tsx scripts/chess/coach.ts --seed 12345 --difficulty hard [--lang pt-br]
 *
 * Prints what the coach says along one puzzle, to proofread her wording: the
 * opening line, one wrong first move of each kind, the two hints, her comment
 * on every right move and the reveal. `--lang` is en (default) or pt-br.
 */
import { type Feedback, chessSeeds, coachFor, explainWrongMove, generateChessFromSpec, positionAfter, resolvePuzzle, toSan } from "@/games/chess/engine";
import { isGameLanguage } from "@/i18n/game-language";
import { isDifficulty } from "@/shared/engine/difficulty";
import { parseArgs } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const difficulty = typeof args.difficulty === "string" ? args.difficulty : "medium";
const language = typeof args.lang === "string" ? args.lang : "en";
if (!isDifficulty(difficulty) || !isGameLanguage(language)) {
  console.error("Use --difficulty easy, medium, hard or expert, and --lang en or pt-br.");
  process.exit(1);
}

const puzzle = generateChessFromSpec(chessSeeds.resolve({ seed: typeof args.seed === "string" ? args.seed : "1", difficulty }));
const resolved = resolvePuzzle(puzzle);
const coach = coachFor(language);
const line = (label: string, text: string) => console.log(`${label.padEnd(22)} ${text}`);

console.log(`${puzzle.seed}: ${puzzle.kind}${puzzle.mateIn ? ` in ${puzzle.mateIn}` : ""}, ${puzzle.solver} to move\n`);
line("intro", coach.intro(resolved).text);

// One wrong first move per kind of feedback. The notation on the left is for the proofreader, the coach never uses it.
const start = positionAfter(resolved, []);
const seen = new Set<Feedback["kind"]>();
for (const move of start.legalMoves()) {
  if (move === resolved.line[0]) continue;
  const feedback = explainWrongMove(start, move, puzzle.kind, puzzle.mateIn);
  if (seen.has(feedback.kind)) continue;
  seen.add(feedback.kind);
  for (const variant of [0, 1]) line(`wrong ${toSan(start, move)} (${feedback.kind})`, coach.wrong(start, move, feedback, variant).text);
}

console.log();
for (let index = 0; index < resolved.line.length; index += 2) {
  const position = positionAfter(resolved, resolved.line.slice(0, index));
  const move = resolved.line[index];
  const turn = index / 2 + 1;
  line(`hint 1, move ${turn}`, coach.pieceHint(resolved, move).text);
  line(`hint 2, move ${turn}`, coach.moveHint(position, move).text);
  const reply = resolved.line[index + 1];
  line(`right move ${turn}`, reply === undefined ? coach.solved(resolved, position, move, turn).text : coach.praise(position, move, reply, turn).text);
}

console.log();
line("reveal", coach.reveal(resolved).text);
