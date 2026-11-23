"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { WEND_GENERATOR_VERSION, wendSeeds } from "../../engine/seed";
import { WendGame } from "./wend-game";

const GAME = GAMES.wend;

/** `/wend/play?seed=…`. The query string fully determines the puzzle. */
export function WendSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(wendSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, wendSeeds, { token: randomSeedToken(), version: WEND_GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }));
  return <WendGame spec={spec} onNext={next} />;
}
