/**
 * npm run wend:benchmark -- [--count 200] [--size 7]
 * Generates many puzzles per tier and reports speed and shape.
 */
import { DIFFICULTIES, generateWendPuzzle, validateWendPuzzle } from "@/games/wend/engine";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 200);
const size = typeof args.size === "string" ? Number(args.size) : undefined;
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const p95 = (values: number[]): number => percentile([...values].sort((a, b) => a - b), 0.95);

console.log(`Wend benchmark, ${count} puzzles per tier\n`);
for (const difficulty of DIFFICULTIES) {
  const times: number[] = [];
  const attempts: number[] = [];
  const bends: number[] = [];
  const words: number[] = [];
  const walls: number[] = [];
  const themes = new Map<string, number>();
  const boards = new Set<string>();
  const sizes = new Map<number, number>();
  let invalid = 0;
  let repeatedLengths = 0;
  for (let index = 0; index < count; index++) {
    const started = performance.now();
    const puzzle = generateWendPuzzle(`bench-${index}`, difficulty, size === undefined ? {} : { size });
    times.push(performance.now() - started);
    attempts.push(puzzle.metadata.attempts);
    bends.push(puzzle.metadata.bendiness);
    words.push(puzzle.words.length);
    walls.push(puzzle.metadata.walls);
    themes.set(puzzle.theme, (themes.get(puzzle.theme) ?? 0) + 1);
    sizes.set(puzzle.size, (sizes.get(puzzle.size) ?? 0) + 1);
    boards.add(puzzle.letters.join("|"));
    if (new Set(puzzle.words.map((word) => word.text.length)).size !== puzzle.words.length) repeatedLengths++;
    if (!validateWendPuzzle(puzzle).ok) invalid++;
  }
  const busiest = [...themes.entries()].sort((a, b) => b[1] - a[1])[0];
  console.log(
    [
      difficulty.padEnd(7),
      `sizes ${[...sizes.entries()].map(([size, total]) => `${size}x${size}:${total}`).join(" ")}`,
      `mean ${mean(times).toFixed(1)} ms`,
      `p95 ${p95(times).toFixed(1)} ms`,
      `max ${Math.max(...times).toFixed(1)} ms`,
      `tries ${mean(attempts).toFixed(2)} (max ${Math.max(...attempts)})`,
      `words ${mean(words).toFixed(1)}`,
      `walls ${mean(walls).toFixed(1)}`,
      `bends/letter ${mean(bends).toFixed(2)}`,
      `repeated lengths ${repeatedLengths}`,
      `themes ${themes.size} (most used: ${busiest[0]}, ${busiest[1]})`,
      `distinct ${boards.size}`,
      `invalid ${invalid}`,
    ].join(" | "),
  );
}
