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
import { generateZipFromSpec } from "../../engine/generator";
import { nextNumber } from "../../engine/rules";
import { type PuzzleSpec, zipSeeds } from "../../engine/seed";
import type { ZipPuzzle } from "../../engine/types";
import { useZipGame } from "../../hooks/use-zip-game";
import { pathColors } from "../board/path-colors";
import { ZipBoard } from "../board/zip-board";
import { ZipTutorialDialog } from "../tutorial/tutorial-dialog";
import "../zip.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.zip;

type GameProps = { spec: PuzzleSpec; daily?: DailyInfo; onNext?: () => void };

export function ZipGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(zipSeeds.format(spec), () => generateZipFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />;
}

type ViewProps = { spec: PuzzleSpec; puzzle: ZipPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = useZipGame({ puzzle, settings });
  const cellCount = puzzle.width * puzzle.height - puzzle.blocked.length;
  const colors = useMemo(() => pathColors(puzzle.id, cellCount), [puzzle.id, cellCount]);

  const filled = game.game.path.length;
  const hiddenCount = puzzle.checkpoints.filter((checkpoint) => checkpoint.hidden).length;
  const startText = hiddenCount === 0 ? "Press 1 and drag to draw the path." : "Press 1 and drag. A ? is a number too, and working out which one is up to you.";
  const idleText = filled === 0 ? startText : `${filled} of ${cellCount} cells. Next number: ${Math.min(nextNumber(game.topology, game.game.path), game.topology.lastNumber)}.`;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.width}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, zipSeeds, spec))}
      session={game}
      idleText={idleText}
      onNext={onNext}
      board={
        <ZipBoard
          puzzle={puzzle}
          topology={game.topology}
          path={game.game.path}
          colors={colors}
          locked={game.locked || !game.ready}
          solved={game.game.status === "solved"}
          shakeSignal={game.shakeSignal}
          refusedCell={game.refusedCell}
          wrongCells={game.wrongCells}
          missingCells={game.missingCells}
          debugSolution={showSolution ? puzzle.solution : null}
          label={`Zip board, ${puzzle.width} by ${puzzle.height}, numbers 1 to ${game.topology.lastNumber}. Arrow keys move the end of the path. Backspace takes a step back.`}
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onKeyStep={game.keyStep}
        />
      }
      tutorial={(props) => <ZipTutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
