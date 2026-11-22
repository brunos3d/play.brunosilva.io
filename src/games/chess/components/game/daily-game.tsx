"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getChessDailyInfo } from "../../engine/daily";
import { ChessGame } from "./chess-game";

/** Today's chess puzzle. "Today" is the Pacific calendar date. */
export function ChessDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.chess} />;
  const daily = getChessDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      <ChessGame spec={daily.spec} daily={daily} />
    </>
  );
}
