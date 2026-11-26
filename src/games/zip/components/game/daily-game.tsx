"use client";

import { GAMES } from "@/games/registry";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { DailyGate } from "@/shared/ui/daily-gate";
import { GameLoading, NewDailyBanner } from "@/shared/ui/game-loading";
import { getZipDailyInfo } from "../../engine/daily";
import { zipPuzzleId } from "../../engine/generator";
import { ZipGame } from "./zip-game";

/** Today's Zip. "Today" is the Pacific calendar date. */
export function ZipDailyGame() {
  const { playing, latest, playLatest } = useDailyDate();
  if (!playing) return <GameLoading game={GAMES.zip} />;
  const daily = getZipDailyInfo(playing);
  return (
    <>
      {latest && latest !== playing && <NewDailyBanner onPlay={playLatest} />}
      {/* One gate per daily: it asks how the day stands for the player before the board is built. */}
      <DailyGate key={daily.seed} game={GAMES.zip} daily={daily} puzzleId={zipPuzzleId(daily.seed)}>
        <ZipGame spec={daily.spec} daily={daily} />
      </DailyGate>
    </>
  );
}
