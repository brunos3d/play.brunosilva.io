"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import { useDailySeedRedirect } from "@/shared/hooks/use-daily-seed-redirect";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { queensDailyDateFromSpec } from "../../engine/daily";
import { QUEENS_GENERATOR_VERSION, queensSeeds } from "../../engine/seed";
import { QueensGame } from "./queens-game";

const GAME = GAMES.queens;

/** `/queens/play?seed=…`. The query string fully determines the puzzle. */
export function QueensSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(queensSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);
  // Today's daily is played on its own page, as the daily.
  useDailySeedRedirect(GAME.path, spec ? queensDailyDateFromSpec(spec) : null);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, queensSeeds, { token: randomSeedToken(), version: QUEENS_GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }));
  return <QueensGame spec={spec} onNext={next} />;
}
