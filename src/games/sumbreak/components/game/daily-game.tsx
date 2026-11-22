"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getSumbreakDailyInfo } from "../../engine/daily";
import { SumbreakGame } from "./sumbreak-game";

/** Today's Sumbreak. "Today" is the Pacific calendar date. */
export function SumbreakDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.sumbreak} />;
  const daily = getSumbreakDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <SumbreakGame spec={daily.spec} daily={daily} />
    </>
  );
}
