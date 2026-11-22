import type { Metadata } from "next";
import { Suspense } from "react";
import { QueensSeedGame } from "@/games/queens/components/game/seed-game";
import { GAMES } from "@/games/registry";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function QueensPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.queens} />}>
      <QueensSeedGame />
    </Suspense>
  );
}
