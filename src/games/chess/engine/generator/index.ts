import type { Difficulty } from "@/shared/engine/difficulty";
import { createRng, hashHex } from "@/shared/engine/prng";
import { normalizeToken } from "@/shared/engine/seed-codec";
import { CHESS_TIERS, FALLBACK_RECIPES, GAMES_PER_FALLBACK, GAMES_PER_RECIPE, GAME_NODE_BUDGET, type Recipe } from "../config";
import { Position, WHITE, moveToUci } from "../position";
import { SearchBudgetExceeded, Searcher } from "../search";
import { CHESS_GENERATOR_VERSION, type PuzzleSpec, chessSeeds } from "../seed";
import type { ChessPuzzle } from "../types";
import { type Mined, mineGame } from "./mine";
import { tagThemes } from "./themes";

/** Id of the puzzle a canonical seed builds. Lets the hub look up a saved board without generating it. */
export const chessPuzzleId = (shareSeed: string): string => `chess-${hashHex(shareSeed).slice(0, 12)}`;

/**
 * Builds the puzzle for a spec. The output depends only on the spec: the PRNG
 * is keyed by token, version and difficulty, every game has its own stream, and
 * the search works on a node budget, never on a clock.
 *
 * The seed draws one recipe of the tier, weighted, and mines games for it. When
 * a few games give nothing, the next recipe of the tier takes over, and after
 * the tier's own recipes come the fallbacks, so every seed ends with a puzzle.
 */
export function generateChessFromSpec(spec: PuzzleSpec): ChessPuzzle {
  if (!chessSeeds.isSupportedVersion(spec.version)) throw new RangeError(`Generator version ${spec.version} is not available in this build.`);
  if (spec.size !== undefined && !chessSeeds.isBoardSize(spec.size)) throw new RangeError(`Board size ${spec.size} is out of range.`);

  const key = chessSeeds.rngKey(spec);
  const tier = CHESS_TIERS[spec.difficulty];
  const rng = createRng(key);

  // Weighted order without replacement: the first recipe is the one this seed wants, the rest are fallbacks.
  const pool = [...tier.recipes];
  const order: Recipe[] = [];
  while (pool.length > 0) {
    const pick = rng.weighted(pool, pool.map((recipe) => recipe.weight));
    order.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }

  let nodes = 0;
  let games = 0;
  const attempts: [Recipe, number][] = [...order.map((recipe): [Recipe, number] => [recipe, GAMES_PER_RECIPE]), ...FALLBACK_RECIPES.map((recipe): [Recipe, number] => [recipe, GAMES_PER_FALLBACK])];
  for (const [recipe, limit] of attempts) {
    for (let game = 0; game < limit; game++) {
      games++;
      const searcher = new Searcher(GAME_NODE_BUDGET);
      let mined: Mined | null = null;
      try {
        mined = mineGame(createRng(`${key}|${recipe.name}|${game}`), tier, recipe, searcher);
      } catch (error) {
        // A game that ran out of budget is dropped. The count is in nodes, so it is dropped on every machine alike.
        if (!(error instanceof SearchBudgetExceeded)) throw error;
      }
      nodes += searcher.nodes;
      if (mined) return assemble(spec, mined, recipe, games, nodes);
    }
  }
  throw new Error("No puzzle could be built from this seed.");
}

function assemble(spec: PuzzleSpec, mined: Mined, recipe: Recipe, games: number, nodes: number): ChessPuzzle {
  const shareSeed = chessSeeds.format({ ...spec, token: normalizeToken(spec.token) });
  const position = Position.fromFen(mined.fen);
  let pieces = 0;
  for (let square = 0; square < 64; square++) if (position.board[square] !== 0) pieces++;
  position.make(mined.setup);
  return {
    id: chessPuzzleId(shareSeed),
    seed: shareSeed,
    version: spec.version,
    difficulty: spec.difficulty,
    fen: mined.fen,
    setup: moveToUci(mined.setup),
    line: mined.line.map(moveToUci),
    solver: position.side === WHITE ? "white" : "black",
    kind: mined.kind,
    mateIn: mined.mateIn,
    themes: tagThemes(position, mined.line, mined.kind, mined.mateIn),
    metadata: { generatorVersion: spec.version, shareSeed, recipe: recipe.name, games, ply: mined.ply, nodes, gain: mined.gain, pieces },
  };
}

export function generateChessPuzzle(seed: string | number, difficulty: Difficulty, options: { version?: number } = {}): ChessPuzzle {
  return generateChessFromSpec({ token: normalizeToken(seed), version: options.version ?? CHESS_GENERATOR_VERSION, difficulty });
}
