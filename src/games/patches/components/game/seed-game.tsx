"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { GENERATOR_VERSION, patchesSeeds } from "../../engine/seed/spec";
import { PatchesGame } from "./patches-game";

const GAME = GAMES.patches;

/** `/patches/play?seed=…`. The query string fully determines the puzzle. */
export function SeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(patchesSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () =>
    router.push(buildPlayPath(GAME.path, patchesSeeds, { token: randomSeedToken(), version: GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }));
  return <PatchesGame spec={spec} onNext={next} />;
}
