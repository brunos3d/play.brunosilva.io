"use client";

import { zipSeeds } from "@/games/zip/engine/seed";
import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";

export default function ZipPracticePage() {
  return <PracticeSetup game={GAMES.zip} codec={zipSeeds} blurb="Unlimited boards from the same generator as the daily, from 5x5 to 8x8. Practice never touches your streak." />;
}
