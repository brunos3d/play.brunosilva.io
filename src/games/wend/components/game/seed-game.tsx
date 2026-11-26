"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import type { GameLanguage } from "@/i18n/game-language";
import { useRouter } from "@/i18n/navigation";
import { useGameLanguageChange } from "@/shared/hooks/use-game-language";
import { useDailySeedRedirect } from "@/shared/hooks/use-daily-seed-redirect";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { wendDailyDateFromSpec } from "../../engine/daily";
import { WEND_GENERATOR_VERSION, wendLanguage, wendSeeds } from "../../engine/seed";
import { WendGame } from "./wend-game";

const GAME = GAMES.wend;

/**
 * `/wend/play?seed=…`. The query string fully determines the puzzle, and that
 * includes the language of its words: a shared link opens the same board for
 * everyone, whatever game language the receiver has set.
 */
export function WendSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(wendSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);
  // Today's daily is played on its own page, as the daily.
  useDailySeedRedirect(GAME.path, spec ? wendDailyDateFromSpec(spec) : null);

  /** A new random puzzle with this one's difficulty and size, in the given language. */
  const another = (language: GameLanguage) => {
    if (!spec) return;
    const next = wendSeeds.withLanguage({ token: randomSeedToken(), version: WEND_GENERATOR_VERSION, difficulty: spec.difficulty, ...(spec.size ? { size: spec.size } : {}) }, language);
    router.push(buildPlayPath(GAME.path, wendSeeds, next));
  };

  // The seed decides the words, so the language setting cannot change the board on screen. When the player picks another language here, they get a new puzzle in it. A pick that matches the board's language already has what it asked for.
  // A round of a challenge room is the exception: its seed is the room's, the same for every player, and it stays.
  useGameLanguageChange((language) => {
    if (spec && !params.has("room") && language !== wendLanguage(spec)) another(language);
  });

  if (!spec) return <GameLoading game={GAME} />;

  // "New" stays in the language of the puzzle on screen, which may not be the one in the settings.
  return <WendGame spec={spec} onNext={() => another(wendLanguage(spec))} />;
}
