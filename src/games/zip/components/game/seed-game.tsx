"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { ZIP_GENERATOR_VERSION, zipSeeds } from "../../engine/seed";
import { ZipGame } from "./zip-game";

const GAME = GAMES.zip;

/** `/zip/play?seed=…`. The query string fully determines the puzzle. */
export function ZipSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(zipSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, zipSeeds, { token: randomSeedToken(), version: ZIP_GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }));
  return <ZipGame spec={spec} onNext={next} />;
}
