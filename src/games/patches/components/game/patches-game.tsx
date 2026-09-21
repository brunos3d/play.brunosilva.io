"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { GAMES } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { useGeneratedPuzzle } from "@/shared/hooks/use-generated-puzzle";
import { useSettings } from "@/shared/hooks/use-settings";
import { buildPlayUrl } from "@/shared/platform/share-text";
import { GameFrame } from "@/shared/ui/game-frame";
import { GameLoading } from "@/shared/ui/game-loading";
import { generateFromSpec } from "../../engine/generator/generate";
import { type PuzzleSpec, patchesSeeds } from "../../engine/seed/spec";
import type { Puzzle } from "../../engine/types";
import { usePatchesGame } from "../../hooks/use-patches-game";
import { Board } from "../board/board";
import { assignPatchColors } from "../board/palette";
import { TutorialDialog } from "../tutorial/tutorial-dialog";
import "../patches.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.patches;

type GameProps = {
  spec: PuzzleSpec;
  /** Present for the daily puzzle. Enables numbering, streaks and the daily result record. */
  daily?: DailyInfo;
  /** Practice only: load another puzzle with the same settings. */
  onNext?: () => void;
};

export function PatchesGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(patchesSeeds.format(spec), () => generateFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />;
}

type ViewProps = { spec: PuzzleSpec; puzzle: Puzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = usePatchesGame({ puzzle, settings });
  const colors = useMemo(() => assignPatchColors(puzzle.clues, puzzle.id), [puzzle]);

  const solved = game.game.status === "solved";
  const placed = game.game.regions.length;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.width}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, patchesSeeds, spec))}
      session={game}
      idleText={placed === 0 ? "Press a clue and drag outward to draw its patch." : `${placed} of ${puzzle.clues.length} patches placed.`}
      onNext={onNext}
      board={
        <Board
          puzzle={puzzle}
          regions={game.game.regions}
          colors={colors}
          hint={game.hint}
          locked={game.locked || !game.ready}
          solved={solved}
          shakeSignal={game.shakeSignal}
          tweenIds={game.tweenIds}
          debugSolution={showSolution ? puzzle.solution : null}
          label={`Patches board, ${puzzle.width} by ${puzzle.height}, ${puzzle.clues.length} clues. Arrow keys move. Enter on a clue starts a patch, arrows grow it, Enter places it. Enter on a patch removes it.`}
          previewStatus={game.previewStatus}
          onPlace={game.place}
          onRemove={game.removeAt}
          onMisstart={game.misstart}
        />
      }
      tutorial={(props) => <TutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
