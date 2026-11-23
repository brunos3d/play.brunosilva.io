import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES } from "@/games/registry";
import { WendSeedGame } from "@/games/wend/components/game/seed-game";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function WendPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.wend} />}>
      <WendSeedGame />
    </Suspense>
  );
}
