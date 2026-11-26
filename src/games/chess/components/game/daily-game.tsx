"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { DailyGate } from "@/shared/ui/daily-gate";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getChessDailyInfo } from "../../engine/daily";
import { chessPuzzleId } from "../../engine/generator";
import { ChessGame } from "./chess-game";

/** Today's chess puzzle. "Today" is the Pacific calendar date. */
export function ChessDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.chess} />;
  const daily = getChessDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      {/* One gate per daily: it asks how the day stands for the player before the board is built. */}
      <DailyGate key={daily.seed} game={GAMES.chess} daily={daily} puzzleId={chessPuzzleId(daily.seed)}>
        <ChessGame spec={daily.spec} daily={daily} />
      </DailyGate>
    </>
  );
}
