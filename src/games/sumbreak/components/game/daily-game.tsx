"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { DailyGate } from "@/shared/ui/daily-gate";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getSumbreakDailyInfo } from "../../engine/daily";
import { sumbreakPuzzleId } from "../../engine/generator";
import { SumbreakGame } from "./sumbreak-game";

/** Today's Sumbreak. "Today" is the Pacific calendar date. */
export function SumbreakDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.sumbreak} />;
  const daily = getSumbreakDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      {/* One gate per daily: it asks how the day stands for the player before the board is built. */}
      <DailyGate key={daily.seed} game={GAMES.sumbreak} daily={daily} puzzleId={sumbreakPuzzleId(daily.seed)}>
        <SumbreakGame spec={daily.spec} daily={daily} />
      </DailyGate>
    </>
  );
}
