"use client";

import { GAMES } from "@/games/registry";
import { wendSeeds } from "@/games/wend/engine/seed";
import { PracticeSetup } from "@/shared/ui/practice-setup";

export default function WendPracticePage() {
  return <PracticeSetup game={GAMES.wend} codec={wendSeeds} blurb="Unlimited themed boards from the same generator as the daily, from 5x5 to 8x8. The words are in Portuguese. Practice never touches your streak." />;
}
