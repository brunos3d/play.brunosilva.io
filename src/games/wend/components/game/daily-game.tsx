"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getWendDailyInfo } from "../../engine/daily";
import { WendGame } from "./wend-game";

/** Today's Wend. "Today" is the Pacific calendar date. */
export function WendDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.wend} />;
  const daily = getWendDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <WendGame spec={daily.spec} daily={daily} />
    </>
  );
}
