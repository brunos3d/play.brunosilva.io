import type { Metadata } from "next";
import { Suspense } from "react";
import { ZipSeedGame } from "@/games/zip/components/game/seed-game";
import { GAMES } from "@/games/registry";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function ZipPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.zip} />}>
      <ZipSeedGame />
    </Suspense>
  );
}
