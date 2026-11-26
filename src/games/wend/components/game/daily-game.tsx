"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { DailyGate } from "@/shared/ui/daily-gate";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getWendDailyInfo } from "../../engine/daily";
import { wendPuzzleId } from "../../engine/seed";
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
      {/* One gate per daily: it asks how the day stands for the player before the board is built. */}
      <DailyGate key={daily.seed} game={GAMES.wend} daily={daily} puzzleId={wendPuzzleId(daily.seed)}>
        <WendGame spec={daily.spec} daily={daily} />
      </DailyGate>
    </>
  );
}
