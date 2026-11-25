import { chessSeeds } from "@/games/chess/engine/seed";
import { patchesSeeds } from "@/games/patches/engine/seed/spec";
import { queensSeeds } from "@/games/queens/engine/seed";
import type { GameId } from "@/games/registry";
import { sumbreakSeeds } from "@/games/sumbreak/engine/seed";
import { termoSeeds } from "@/games/termo/engine/seed";
import { wendSeeds } from "@/games/wend/engine/seed";
import { zipSeeds } from "@/games/zip/engine/seed";
import type { SeedCodec } from "@/shared/engine/seed-codec";

/**
 * The seed format of every game, by game id. Code that handles puzzles of any
 * game, such as a challenge room, builds and checks seeds through this table.
 * It imports the seed modules only, which are small: no generator, no solver
 * and no word list comes along.
 */
export const SEED_CODECS: Record<GameId, SeedCodec> = {
  zip: zipSeeds,
  patches: patchesSeeds,
  chess: chessSeeds,
  queens: queensSeeds,
  sumbreak: sumbreakSeeds,
  wend: wendSeeds,
  termo: termoSeeds,
};
