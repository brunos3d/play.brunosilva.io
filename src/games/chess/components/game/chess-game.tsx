"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { GAMES } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGeneratedPuzzle } from "@/shared/hooks/use-generated-puzzle";
import { useSettings } from "@/shared/hooks/use-settings";
import { buildPlayUrl } from "@/shared/platform/share-text";
import { GameFrame } from "@/shared/ui/game-frame";
import { GameLoading } from "@/shared/ui/game-loading";
import { PuzzleAttempts } from "@/shared/ui/puzzle-attempts";
import { generateChessFromSpec } from "../../engine/generator";
import { WHITE } from "../../engine/position";
import { CHESS_BOARD_SIZE, type PuzzleSpec, chessSeeds } from "../../engine/seed";
import type { ChessPuzzle } from "../../engine/types";
import { useChessGame } from "../../hooks/use-chess-game";
import { ChessBoard } from "../board/chess-board";
import { CoachPanel } from "../coach/coach-panel";
import { ChessTutorialDialog } from "../tutorial/tutorial-dialog";
import "../chess.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.chess;

type GameProps = { spec: PuzzleSpec; daily?: DailyInfo; onNext?: () => void };

export function ChessGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(chessSeeds.format(spec), () => generateChessFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return (
    <PuzzleAttempts game="chess" puzzle={generated.puzzle} enabled={onNext !== undefined}>
      <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />
    </PuzzleAttempts>
  );
}

type ViewProps = { spec: PuzzleSpec; puzzle: ChessPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const t = useTranslations("chess");
  const { settings } = useSettings();
  // The coach speaks the game language. Everything else on the page is in the interface locale.
  const { language } = useGameLanguage();
  const game = useChessGame({ puzzle, settings, language });
  const awaitingTakeBack = game.game.wrong !== null && !game.busy;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={CHESS_BOARD_SIZE}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, chessSeeds, spec))}
      session={game}
      idleText=""
      onNext={onNext}
      board={
        <ChessBoard
          view={game.view}
          orientation={game.solverColor}
          targets={game.targets}
          locked={game.locked || !game.ready || !game.opened || game.busy}
          awaitingTakeBack={awaitingTakeBack}
          hintSquare={game.hintSquare}
          verdict={game.verdict}
          shakeSignal={game.shakeSignal}
          label={t("board.label", { side: game.solverColor === WHITE ? "white" : "black" })}
          onMove={game.tryMove}
          onTakeBack={game.takeBack}
        />
      }
      statusSlot={<CoachPanel coach={game.coach} messages={game.messages} status={game.status} thinking={game.busy && !game.locked} awaitingTakeBack={awaitingTakeBack} />}
      tutorial={(props) => <ChessTutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} /> : undefined}
    />
  );
}
