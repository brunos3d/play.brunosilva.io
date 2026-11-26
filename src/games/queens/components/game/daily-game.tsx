"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { DailyGate } from "@/shared/ui/daily-gate";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getQueensDailyInfo } from "../../engine/daily";
import { queensPuzzleId } from "../../engine/generator";
import { QueensGame } from "./queens-game";

/** Today's Queens. "Today" is the Pacific calendar date. */
export function QueensDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.queens} />;
  const daily = getQueensDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      {/* One gate per daily: it asks how the day stands for the player before the board is built. */}
      <DailyGate key={daily.seed} game={GAMES.queens} daily={daily} puzzleId={queensPuzzleId(daily.seed)}>
        <QueensGame spec={daily.spec} daily={daily} />
      </DailyGate>
    </>
  );
}
