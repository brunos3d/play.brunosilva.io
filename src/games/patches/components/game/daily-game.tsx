"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { DailyGate } from "@/shared/ui/daily-gate";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getDailyInfo } from "../../engine/daily/schedule";
import { patchesPuzzleId } from "../../engine/generator/generate";
import { PatchesGame } from "./patches-game";

/** Today's Patches. "Today" is the Pacific calendar date. */
export function DailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.patches} />;
  const daily = getDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      {/* One gate per daily: it asks how the day stands for the player before the board is built. */}
      <DailyGate key={daily.seed} game={GAMES.patches} daily={daily} puzzleId={patchesPuzzleId(daily.seed)}>
        <PatchesGame spec={daily.spec} daily={daily} />
      </DailyGate>
    </>
  );
}
