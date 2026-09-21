import type { Metadata } from "next";
import { Suspense } from "react";
import { SeedGame } from "@/games/patches/components/game/seed-game";
import { GAMES } from "@/games/registry";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function PatchesPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.patches} />}>
      <SeedGame />
    </Suspense>
  );
}
