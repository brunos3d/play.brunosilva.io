"use client";

import { patchesSeeds } from "@/games/patches/engine/seed/spec";
import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";

export default function PatchesPracticePage() {
  return <PracticeSetup game={GAMES.patches} codec={patchesSeeds} blurb="Unlimited puzzles from the same generator as the daily. Practice never touches your streak." />;
}
