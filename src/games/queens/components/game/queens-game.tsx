"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { GAMES } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { useGeneratedPuzzle } from "@/shared/hooks/use-generated-puzzle";
import { useSettings } from "@/shared/hooks/use-settings";
import { buildPlayUrl } from "@/shared/platform/share-text";
import { GameFrame } from "@/shared/ui/game-frame";
import { GameLoading } from "@/shared/ui/game-loading";
import { PuzzleAttempts } from "@/shared/ui/puzzle-attempts";
import { queensOf } from "../../engine/game/state";
import { generateQueensFromSpec } from "../../engine/generator";
import type { UnitNamer } from "../../engine/hint";
import { type PuzzleSpec, queensSeeds } from "../../engine/seed";
import type { QueensPuzzle } from "../../engine/types";
import { useQueensGame } from "../../hooks/use-queens-game";
import { assignRegionColors } from "../board/palette";
import { QueensBoard } from "../board/queens-board";
import { QueensTutorialDialog } from "../tutorial/tutorial-dialog";
import "../queens.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.queens;

type GameProps = {
  spec: PuzzleSpec;
  /** Present for the daily puzzle. Enables numbering, streaks and the daily result record. */
  daily?: DailyInfo;
  /** Practice only: load another puzzle with the same settings. */
  onNext?: () => void;
};

export function QueensGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(queensSeeds.format(spec), () => generateQueensFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return (
    <PuzzleAttempts game="queens" puzzle={generated.puzzle} enabled={onNext !== undefined}>
      <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />
    </PuzzleAttempts>
  );
}

type ViewProps = { spec: PuzzleSpec; puzzle: QueensPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const colors = useMemo(() => assignRegionColors(puzzle, puzzle.id), [puzzle]);
  // Hints name a region by its colour, the way a player would point at it.
  const nameUnit = useCallback<UnitNamer>((unit) => (unit.kind === "region" ? `the ${colors[unit.index].name} region` : `${unit.kind} ${unit.index + 1}`), [colors]);
  const game = useQueensGame({ puzzle, settings, nameUnit });

  const placed = queensOf(game.game.marks).length;
  const idleText = placed === 0 ? "Tap a cell once for an X, twice for a queen. Drag to mark several cells." : `${placed} of ${puzzle.size} queens placed.`;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.size}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, queensSeeds, spec))}
      session={game}
      idleText={idleText}
      onNext={onNext}
      board={
        <QueensBoard
          puzzle={puzzle}
          topology={game.topology}
          marks={game.game.marks}
          colors={colors}
          locked={game.locked || !game.ready}
          solved={game.game.status === "solved"}
          shakeSignal={game.shakeSignal}
          refused={game.refused}
          wrongCells={game.wrongCells}
          hintCells={game.hintCells}
          hintTargets={game.hintTargets}
          debugSolution={showSolution ? puzzle.solution : null}
          label={`Queens board, ${puzzle.size} by ${puzzle.size}, ${puzzle.size} coloured regions. Arrow keys move. Enter or Space turns a cell into an X, then a queen, then empty. Delete clears it.`}
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onKeyCycle={game.keyCycle}
          onKeyClear={game.keyClear}
        />
      }
      tutorial={(props) => <QueensTutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
