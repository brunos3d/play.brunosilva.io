"use client";

import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";
import { zipSeeds } from "../../engine/seed";

/** `/zip/practice`: the shared setup screen with this game's seed format and board sizes. */
export function ZipPractice() {
  return <PracticeSetup game={GAMES.zip} codec={zipSeeds} />;
}
