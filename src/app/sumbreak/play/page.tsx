import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES } from "@/games/registry";
import { SumbreakSeedGame } from "@/games/sumbreak/components/game/seed-game";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function SumbreakPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.sumbreak} />}>
      <SumbreakSeedGame />
    </Suspense>
  );
}
