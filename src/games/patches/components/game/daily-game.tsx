"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getDailyInfo } from "../../engine/daily/schedule";
import { PatchesGame } from "./patches-game";

/** Today's Patches. "Today" is the Pacific calendar date. */
export function DailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.patches} />;
  const daily = getDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <PatchesGame spec={daily.spec} daily={daily} />
    </>
  );
}
