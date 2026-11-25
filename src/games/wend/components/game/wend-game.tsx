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
import { foundWords } from "../../engine/game/state";
import { loadWendPuzzle } from "../../engine/generator";
import { type PuzzleSpec, wendSeeds } from "../../engine/seed";
import { idleText } from "../../engine/text";
import type { WendPuzzle } from "../../engine/types";
import { useWendGame } from "../../hooks/use-wend-game";
import { wordColors } from "../board/palette";
import { WendBoard } from "../board/wend-board";
import { WendWordList } from "../board/word-list";
import { WendTutorialDialog } from "../tutorial/tutorial-dialog";
import "../wend.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.wend;

type GameProps = {
  spec: PuzzleSpec;
  /** Present for the daily puzzle. Enables numbering, streaks and the daily result record. */
  daily?: DailyInfo;
  /** Practice only: load another puzzle with the same settings. */
  onNext?: () => void;
};

/**
 * Builds the puzzle of a spec and plays it. The words are in the language the
 * spec names. Their word bank is downloaded here, on first use, so a player
 * only ever fetches the language they play in.
 */
export function WendGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(wendSeeds.format(spec), () => loadWendPuzzle(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return (
    <PuzzleAttempts game="wend" puzzle={generated.puzzle} enabled={onNext !== undefined}>
      <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />
    </PuzzleAttempts>
  );
}

type ViewProps = { spec: PuzzleSpec; puzzle: WendPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const t = useTranslations("wend");
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = useWendGame({ puzzle, settings });
  const colors = useMemo(() => wordColors(puzzle.id, puzzle.words.length), [puzzle.id, puzzle.words.length]);

  const remaining = puzzle.words.length - foundWords(game.game).length;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.size}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, wendSeeds, spec))}
      session={game}
      idleText={idleText(
        t,
        puzzle.words.map((word) => word.text.length),
        remaining,
      )}
      onNext={onNext}
      board={
        <div className="wend-stage">
          <WendBoard
            shape={puzzle}
            trails={game.game.trails}
            active={game.game.active}
            colors={colors}
            locked={game.locked || !game.ready || game.busy}
            solved={game.game.status === "solved"}
            hintCell={game.hintCell}
            foundSignal={game.foundSignal}
            debugSolution={showSolution}
            label={t("board.label", { size: puzzle.size })}
            onPress={game.press}
            onDrag={game.drag}
            onRelease={game.release}
            onTap={game.tap}
            onBack={game.back}
          />
          <WendWordList shape={puzzle} state={game.game} colors={colors} theme={puzzle.theme} themeShown={puzzle.themeShown} />
        </div>
      }
      tutorial={(props) => <WendTutorialDialog {...props} language={puzzle.language} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
