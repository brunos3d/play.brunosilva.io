"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import { useDailySeedRedirect } from "@/shared/hooks/use-daily-seed-redirect";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { sumbreakDailyDateFromSpec } from "../../engine/daily";
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
  // Today's daily is played on its own page, as the daily.
  useDailySeedRedirect(GAME.path, spec ? sumbreakDailyDateFromSpec(spec) : null);

  if (!spec) return <GameLoading game={GAME} />;

  const next = () => router.push(buildPlayPath(GAME.path, sumbreakSeeds, { token: randomSeedToken(), version: SUMBREAK_GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }));
  return <SumbreakGame spec={spec} onNext={next} />;
}
