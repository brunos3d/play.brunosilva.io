"use client";

import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";
import { chessSeeds } from "../../engine/seed";

/** `/chess/practice`: the shared setup screen with this game's seed format and board sizes. */
export function ChessPractice() {
  return <PracticeSetup game={GAMES.chess} codec={chessSeeds} />;
}
