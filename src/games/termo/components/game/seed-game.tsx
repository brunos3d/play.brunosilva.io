"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { termoDailyVariantFromSpec } from "../../engine/daily";
import { TERMO_GENERATOR_VERSION, termoSeeds } from "../../engine/seed";
import { TermoGame } from "./termo-game";

const GAME = GAMES.termo;

/** `/termo/play?seed=…`. The query string fully determines the puzzle. */
export function TermoSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(termoSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, termoSeeds, { token: randomSeedToken(), version: TERMO_GENERATOR_VERSION, difficulty: spec.difficulty }));
  // The day's Dueto and Quarteto are one puzzle each, like the daily: there is no "New game" on them.
  return <TermoGame spec={spec} onNext={termoDailyVariantFromSpec(spec) ? undefined : next} />;
}
