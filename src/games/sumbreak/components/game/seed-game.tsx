"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { SUMBREAK_GENERATOR_VERSION, sumbreakSeeds } from "../../engine/seed";
import { SumbreakGame } from "./sumbreak-game";

const GAME = GAMES.sumbreak;

/** `/sumbreak/play?seed=…`. The query string fully determines the puzzle. */
export function SumbreakSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(sumbreakSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, sumbreakSeeds, { token: randomSeedToken(), version: SUMBREAK_GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }));
  return <SumbreakGame spec={spec} onNext={next} />;
}
