"use client";

import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";
import { sumbreakSeeds } from "../../engine/seed";

/** `/sumbreak/practice`: the shared setup screen with this game's seed format and board sizes. */
export function SumbreakPractice() {
  return <PracticeSetup game={GAMES.sumbreak} codec={sumbreakSeeds} />;
}
