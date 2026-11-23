"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getTermoDailyInfo } from "../../engine/daily";
import { TermoGame } from "./termo-game";

/** Today's Termo. "Today" is the Pacific calendar date. */
export function TermoDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.termo} />;
  const daily = getTermoDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <TermoGame spec={daily.spec} daily={daily} />
    </>
  );
}
