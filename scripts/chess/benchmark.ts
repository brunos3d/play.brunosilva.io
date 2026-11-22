/**
 * npm run chess:benchmark -- [--count 200]
 * Generates `count` puzzles per tier and reports speed, recipes, themes and how
 * many games each puzzle took.
 */
import { DIFFICULTIES, type Difficulty, generateChessPuzzle, validateChessPuzzle } from "@/games/chess/engine";
import { hashHex } from "@/shared/engine/prng";
import { parseArgs, percentile } from "../shared/cli";

const args = parseArgs(process.argv.slice(2));
const count = Number(args.count ?? 200);

function tally(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
const list = (map: Map<string, number>): string => [...map].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name}: ${n}`).join(", ");

function runTier(difficulty: Difficulty): number {
  const ms: number[] = [];
  const positions = new Set<string>();
  const recipes = new Map<string, number>();
  const themes = new Map<string, number>();
  const sides = new Map<string, number>();
  let invalid = 0, games = 0, nodes = 0, pieces = 0, ply = 0;

  for (let i = 0; i < count; i++) {
    const started = performance.now();
    const puzzle = generateChessPuzzle(`benchmark-${i}`, difficulty);
    ms.push(performance.now() - started);
    if (!validateChessPuzzle(puzzle).ok) invalid++;
    positions.add(hashHex(`${puzzle.fen}|${puzzle.setup}`));
    tally(recipes, puzzle.metadata.recipe);
    tally(sides, puzzle.solver);
    for (const theme of puzzle.themes) tally(themes, theme);
    games += puzzle.metadata.games;
    nodes += puzzle.metadata.nodes;
    pieces += puzzle.metadata.pieces;
    ply += puzzle.metadata.ply;
  }
  ms.sort((a, b) => a - b);
  const mean = ms.reduce((sum, value) => sum + value, 0) / count;
  const fmt = (value: number) => value.toFixed(1);
  console.log(`\n${difficulty.toUpperCase()}  (${count} puzzles)`);
  console.log(`  generation ms   mean ${fmt(mean)}  p50 ${fmt(percentile(ms, 0.5))}  p95 ${fmt(percentile(ms, 0.95))}  max ${fmt(ms[count - 1])}`);
  console.log(`  invalid         ${invalid}   duplicates ${count - positions.size}`);
  console.log(`  mining          ${fmt(games / count)} games and ${Math.round(nodes / count / 1000)}k nodes per puzzle`);
  console.log(`  positions       half-move ${fmt(ply / count)}, ${fmt(pieces / count)} pieces, ${list(sides)}`);
  console.log(`  recipes         ${list(recipes)}`);
  console.log(`  themes          ${list(themes)}`);
  return invalid;
}

let invalid = 0;
for (const difficulty of DIFFICULTIES) invalid += runTier(difficulty);
if (invalid > 0) {
  console.error(`\n${invalid} invalid puzzles`);
  process.exit(1);
}
