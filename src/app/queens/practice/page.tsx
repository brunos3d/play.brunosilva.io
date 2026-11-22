"use client";

import { queensSeeds } from "@/games/queens/engine/seed";
import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";

export default function QueensPracticePage() {
  return <PracticeSetup game={GAMES.queens} codec={queensSeeds} blurb="Unlimited boards from the same generator as the daily, from 5x5 to 10x10. Practice never touches your streak." />;
}
