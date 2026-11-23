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
import { foundWords } from "../../engine/game/state";
import { generateWendFromSpec } from "../../engine/generator";
import { type PuzzleSpec, wendSeeds } from "../../engine/seed";
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

export function WendGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(wendSeeds.format(spec), () => generateWendFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />;
}

type ViewProps = { spec: PuzzleSpec; puzzle: WendPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

const lengthsText = (lengths: readonly number[]): string => (lengths.length === 1 ? String(lengths[0]) : `${lengths.slice(0, -1).join(", ")} e ${lengths[lengths.length - 1]}`);

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = useWendGame({ puzzle, settings });
  const colors = useMemo(() => wordColors(puzzle.id, puzzle.words.length), [puzzle.id, puzzle.words.length]);

  const total = puzzle.words.length;
  const remaining = total - foundWords(game.game).length;
  const idleText =
    remaining === total
      ? `Encontre ${total} palavras escondidas, de ${lengthsText(puzzle.words.map((word) => word.text.length))} letras. Cada letra é usada uma só vez.`
      : remaining === 1
        ? "Falta 1 palavra. Ela usa todas as letras que sobraram."
        : `Faltam ${remaining} palavras. Cada letra é usada uma só vez.`;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={puzzle.size}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, wendSeeds, spec))}
      session={game}
      idleText={idleText}
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
            label={`Tabuleiro do Wend, ${puzzle.size} por ${puzzle.size}. As setas movem o cursor, Enter marca a letra e Backspace tira a última letra do traço.`}
            onPress={game.press}
            onDrag={game.drag}
            onRelease={game.release}
            onTap={game.tap}
            onBack={game.back}
          />
          <WendWordList shape={puzzle} state={game.game} colors={colors} theme={puzzle.theme} themeShown={puzzle.themeShown} />
        </div>
      }
      tutorial={(props) => <WendTutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
