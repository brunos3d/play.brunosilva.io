/**
 * npm run termo:benchmark -- [--count 2000]
 * Generates `count` puzzles per tier and reports speed, how the words spread over the answer list, and how often a word repeats.
 */
import { DIFFICULTIES, type Difficulty, answerWords, generateTermoPuzzle, isKnownWord, knownWordCount, validateTermoPuzzle } from "@/games/termo/engine";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 2000);

// The lists are cut up on first use. Time that once, apart from the puzzles.
const loadStarted = performance.now();
answerWords();
isKnownWord("festa");
console.log(`word lists    ${answerWords().length} answers, ${knownWordCount()} accepted guesses, cut up in ${(performance.now() - loadStarted).toFixed(2)} ms`);

function runTier(difficulty: Difficulty): number {
  const ms: number[] = [];
  const ranks: number[] = [];
  const words = new Set<string>();
  let invalid = 0;
  let drawn = 0;

  for (let i = 0; i < count; i++) {
    const started = performance.now();
    const puzzle = generateTermoPuzzle(`benchmark-${i}`, difficulty);
    ms.push(performance.now() - started);
    if (!validateTermoPuzzle(puzzle).ok) invalid++;
    for (const word of puzzle.answers) words.add(word);
    ranks.push(...puzzle.metadata.ranks);
    drawn += puzzle.answers.length;
  }
  ms.sort((a, b) => a - b);
  ranks.sort((a, b) => a - b);
  const mean = ms.reduce((sum, value) => sum + value, 0) / count;
  const fmt = (value: number) => value.toFixed(3);
  console.log(`\n${difficulty.toUpperCase()}  (${count} puzzles)`);
  console.log(`  generation ms   mean ${fmt(mean)}  p50 ${fmt(percentile(ms, 0.5))}  p95 ${fmt(percentile(ms, 0.95))}  max ${fmt(ms[count - 1])}`);
  console.log(`  invalid         ${invalid}`);
  console.log(`  words           ${drawn} drawn, ${words.size} different`);
  console.log(`  rank in list    p10 ${percentile(ranks, 0.1) + 1}  p50 ${percentile(ranks, 0.5) + 1}  p90 ${percentile(ranks, 0.9) + 1}  max ${ranks[ranks.length - 1] + 1}`);
  return invalid;
}

let invalid = 0;
for (const difficulty of DIFFICULTIES) invalid += runTier(difficulty);
if (invalid > 0) {
  console.error(`\n${invalid} invalid puzzles`);
  process.exit(1);
}
