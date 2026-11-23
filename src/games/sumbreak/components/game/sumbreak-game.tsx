"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { GAMES } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { useGeneratedPuzzle } from "@/shared/hooks/use-generated-puzzle";
import { useSettings } from "@/shared/hooks/use-settings";
import { buildPlayUrl } from "@/shared/platform/share-text";
import { GameFrame } from "@/shared/ui/game-frame";
import { GameLoading } from "@/shared/ui/game-loading";
import { PuzzleAttempts } from "@/shared/ui/puzzle-attempts";
import { generateSumbreakFromSpec } from "../../engine/generator";
import { countTiles } from "../../engine/rules";
import { type PuzzleSpec, sumbreakSeeds } from "../../engine/seed";
import type { SumbreakPuzzle } from "../../engine/types";
import { useSumbreakGame } from "../../hooks/use-sumbreak-game";
import { SumbreakBoard } from "../board/sumbreak-board";
import { SumbreakTutorialDialog } from "../tutorial/tutorial-dialog";
import "../sumbreak.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.sumbreak;

type GameProps = {
  spec: PuzzleSpec;
  /** Present for the daily puzzle. Enables numbering, streaks and the daily result record. */
  daily?: DailyInfo;
  /** Practice only: load another puzzle with the same settings. */
  onNext?: () => void;
};

export function SumbreakGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(sumbreakSeeds.format(spec), () => generateSumbreakFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return (
    <PuzzleAttempts game="sumbreak" puzzle={generated.puzzle} enabled={onNext !== undefined}>
      <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />
    </PuzzleAttempts>
  );
}

type ViewProps = { spec: PuzzleSpec; puzzle: SumbreakPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = useSumbreakGame({ puzzle, settings });

  const left = countTiles(game.game.cells);
  const idleText = game.game.history.length === 0 ? `Drag a number onto an equal neighbour. They merge into their sum, and the last tile will be ${puzzle.total}.` : `${left} tiles left. The last one will be ${puzzle.total}.`;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.size}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, sumbreakSeeds, spec))}
      session={game}
      idleText={idleText}
      onNext={onNext}
      board={
        <SumbreakBoard
          size={puzzle.size}
          tiles={game.tiles}
          lastMerge={game.lastMerge}
          hinted={game.hinted}
          locked={game.locked || !game.ready || game.busy}
          solved={game.game.status === "solved"}
          stuck={game.stuck}
          shakeSignal={game.shakeSignal}
          refusedCell={game.refusedCell}
          label={`Sumbreak board, ${puzzle.size} by ${puzzle.size}. Arrow keys move. Enter picks up a tile, and Enter on an equal neighbour drops it there.`}
          onMerge={game.merge}
        />
      }
      tutorial={(props) => <SumbreakTutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
