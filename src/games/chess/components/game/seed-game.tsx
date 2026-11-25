"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { CHESS_GENERATOR_VERSION, chessSeeds } from "../../engine/seed";
import { ChessGame } from "./chess-game";

const GAME = GAMES.chess;

/** `/chess/play?seed=…`. The query string fully determines the puzzle. "New" loads another one of the same difficulty, so practice never runs out. */
export function ChessSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(chessSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, chessSeeds, { token: randomSeedToken(), version: CHESS_GENERATOR_VERSION, difficulty: spec.difficulty }));
  return <ChessGame spec={spec} onNext={next} />;
}
