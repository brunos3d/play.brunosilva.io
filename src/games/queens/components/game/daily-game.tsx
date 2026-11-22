"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getQueensDailyInfo } from "../../engine/daily";
import { QueensGame } from "./queens-game";

/** Today's Queens. "Today" is the Pacific calendar date. */
export function QueensDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.queens} />;
  const daily = getQueensDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <QueensGame spec={daily.spec} daily={daily} />
    </>
  );
}
