"use client";

import { chessSeeds } from "@/games/chess/engine/seed";
import { GAMES } from "@/games/registry";
import { PracticeSetup } from "@/shared/ui/practice-setup";

export default function ChessPracticePage() {
  return <PracticeSetup game={GAMES.chess} codec={chessSeeds} blurb="Unlimited puzzles from the same generator as the daily: one move on easy, up to a mate in three on expert. Each one comes from a game played out from the starting position. Practice never touches your streak." />;
}
