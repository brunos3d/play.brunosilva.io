"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { GAMES } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { useGeneratedPuzzle } from "@/shared/hooks/use-generated-puzzle";
import { useSettings } from "@/shared/hooks/use-settings";
import { buildPlayUrl } from "@/shared/platform/share-text";
import { GameFrame } from "@/shared/ui/game-frame";
import { GameLoading } from "@/shared/ui/game-loading";
import { PuzzleAttempts } from "@/shared/ui/puzzle-attempts";
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
  return (
    <PuzzleAttempts game="patches" puzzle={generated.puzzle} enabled={onNext !== undefined}>
      <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />
    </PuzzleAttempts>
  );
}

type ViewProps = { spec: PuzzleSpec; puzzle: Puzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const t = useTranslations("patches");
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = usePatchesGame({ puzzle, settings });
  const colors = useMemo(() => assignPatchColors(puzzle.clues, puzzle.id), [puzzle]);

  const solved = game.game.status === "solved";
  const placed = game.game.regions.length - game.pendingIds.size;
  const unfinished = game.pendingIds.size;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.width}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, patchesSeeds, spec))}
      session={game}
      idleText={placed + unfinished === 0 ? t("idle.start") : t("idle.progress", { placed, total: puzzle.clues.length, unfinished })}
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
          pendingIds={game.pendingIds}
          tweenIds={game.tweenIds}
          debugSolution={showSolution ? puzzle.solution : null}
          label={t("board.label", { width: puzzle.width, height: puzzle.height, clues: puzzle.clues.length })}
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
