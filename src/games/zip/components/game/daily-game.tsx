"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getZipDailyInfo } from "../../engine/daily";
import { ZipGame } from "./zip-game";

/** Today's Zip. "Today" is the Pacific calendar date. */
export function ZipDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.zip} />;
  const daily = getZipDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <ZipGame spec={daily.spec} daily={daily} />
    </>
  );
}
