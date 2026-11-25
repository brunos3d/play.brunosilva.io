"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getTermoDailyInfo } from "../../engine/daily";
import { TermoGame } from "./termo-game";

/**
 * Today's Termo, in the player's game language. "Today" is the Pacific
 * calendar date. Each language has its own daily word and its own result, so
 * changing the game language in the settings swaps to that language's puzzle
 * of the same day.
 */
export function TermoDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  const { language, ready } = useGameLanguage();
  // The stored language is not known during hydration. Waiting for it keeps the page from building one language's puzzle and then swapping to the other.
  if (!playing || !ready) return <GameLoading game={GAMES.termo} />;
  const daily = getTermoDailyInfo(playing, language);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <TermoGame key={daily.seed} spec={daily.spec} daily={daily} />
    </>
  );
}
