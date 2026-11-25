"use client";

import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";
import { patchesSeeds } from "../../engine/seed/spec";

/** `/patches/practice`: the shared setup screen with this game's seed format and board sizes. */
export function PatchesPractice() {
  return <PracticeSetup game={GAMES.patches} codec={patchesSeeds} />;
}
