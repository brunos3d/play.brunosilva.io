import type { Metadata } from "next";
import { Suspense } from "react";
import { ChessSeedGame } from "@/games/chess/components/game/seed-game";
import { GAMES } from "@/games/registry";
import { GameLoading } from "@/shared/ui/game-loading";

export const metadata: Metadata = { title: "Practice puzzle" };

export default function ChessPlayPage() {
  return (
    <Suspense fallback={<GameLoading game={GAMES.chess} />}>
      <ChessSeedGame />
    </Suspense>
  );
}
