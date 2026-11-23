import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES } from "@/games/registry";
import { TermoSeedGame } from "@/games/termo/components/game/seed-game";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function TermoPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.termo} />}>
      <TermoSeedGame />
    </Suspense>
  );
}
