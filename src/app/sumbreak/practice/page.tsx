"use client";

import { GAMES } from "@/games/registry";
import { sumbreakSeeds } from "@/games/sumbreak/engine/seed";
import { PracticeSetup } from "@/shared/ui/practice-setup";

export default function SumbreakPracticePage() {
  return <PracticeSetup game={GAMES.sumbreak} codec={sumbreakSeeds} blurb="Unlimited boards from the same generator as the daily, from 3x3 to 5x5. Practice never touches your streak." />;
}
