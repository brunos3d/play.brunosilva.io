"use client";

import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";
import { wendSeeds } from "../../engine/seed";

/** `/wend/practice`: the shared setup screen with this game's seed format and board sizes. */
export function WendPractice() {
  return <PracticeSetup game={GAMES.wend} codec={wendSeeds} />;
}
