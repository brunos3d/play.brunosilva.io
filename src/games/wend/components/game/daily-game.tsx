"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getWendDailyInfo } from "../../engine/daily";
import { WendGame } from "./wend-game";

/**
 * Today's Wend. "Today" is the Pacific calendar date, and the words are in the
 * player's game language: each language has its own daily puzzle. The board
 * waits for the stored language, so it never builds one language and then
 * swaps to the other. Picking another language in the settings shows that
 * language's puzzle of the day.
 */
export function WendDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  const { language, ready } = useGameLanguage();
  if (!playing || !ready) return <GameLoading game={GAMES.wend} />;
  const daily = getWendDailyInfo(playing, language);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <WendGame spec={daily.spec} daily={daily} />
    </>
  );
}
