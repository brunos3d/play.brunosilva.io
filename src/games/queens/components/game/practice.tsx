"use client";

import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";
import { queensSeeds } from "../../engine/seed";

/** `/queens/practice`: the shared setup screen with this game's seed format and board sizes. */
export function QueensPractice() {
  return <PracticeSetup game={GAMES.queens} codec={queensSeeds} />;
}
