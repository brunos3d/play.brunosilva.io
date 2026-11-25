"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GAMES } from "@/games/registry";
import type { GameLanguage } from "@/i18n/game-language";
import { useRouter } from "@/i18n/navigation";
import { useGameLanguageChange } from "@/shared/hooks/use-game-language";
import { buildPlayPath, specFromSearchParams } from "@/shared/platform/share-text";
import { GameLoading } from "@/shared/ui/game-loading";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { termoDailyVariantFromSpec, termoDailyVariantSpec } from "../../engine/daily";
import { TERMO_GENERATOR_VERSION, termoLanguage, termoSeeds } from "../../engine/seed";
import { TermoGame } from "./termo-game";

const GAME = GAMES.termo;

/**
 * `/termo/play?seed=…`. The query string fully determines the puzzle, and that
 * includes the language of its words: a shared link opens the same words for
 * everyone, whatever game language the receiver has.
 */
export function TermoSeedGame() {
  const router = useRouter();
  const params = useSearchParams();
  const spec = specFromSearchParams(termoSeeds, new URLSearchParams(params.toString()));

  useEffect(() => {
    if (!spec) router.replace(`${GAME.path}/practice`);
  }, [router, spec]);

  // The day's Dueto and Quarteto are one puzzle each, like the daily, in each language.
  const ofTheDay = spec ? termoDailyVariantFromSpec(spec) : null;
  /** A new random puzzle of the same mode. */
  const random = (language: GameLanguage) => {
    if (spec) router.push(buildPlayPath(GAME.path, termoSeeds, termoSeeds.withLanguage({ token: randomSeedToken(), version: TERMO_GENERATOR_VERSION, difficulty: spec.difficulty }, language)));
  };

  // The player picked another game language in the settings while this puzzle is open. The puzzle keeps the language of its seed, so the page moves on: to the same day's puzzle in that language, or to a new practice puzzle of the same mode.
  useGameLanguageChange((language) => {
    if (!spec || termoLanguage(spec) === language) return;
    if (ofTheDay) router.push(buildPlayPath(GAME.path, termoSeeds, termoDailyVariantSpec(ofTheDay.date, ofTheDay.variant, language)));
    else random(language);
  });

  if (!spec) return <GameLoading game={GAME} />;

  // "New" keeps the language of the puzzle on screen. There is no "New" on the day's Dueto and Quarteto.
  return <TermoGame spec={spec} onNext={ofTheDay ? undefined : () => random(termoLanguage(spec))} />;
}
