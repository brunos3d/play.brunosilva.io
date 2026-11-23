"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { GAMES } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { useGeneratedPuzzle } from "@/shared/hooks/use-generated-puzzle";
import { useSettings } from "@/shared/hooks/use-settings";
import { buildPlayUrl } from "@/shared/platform/share-text";
import { GameFrame } from "@/shared/ui/game-frame";
import { GameLoading } from "@/shared/ui/game-loading";
import { PuzzleAttempts } from "@/shared/ui/puzzle-attempts";
import { type StatusMessage, StatusLine } from "@/shared/ui/status-line";
import { termoDailyVariantFromSpec } from "../../engine/daily";
import { boardRows, hintLetters, solvedBoards } from "../../engine/game/state";
import { generateTermoFromSpec } from "../../engine/generator";
import { letterStates } from "../../engine/rules";
import { type PuzzleSpec, TERMO_WORD_LENGTH, termoSeeds } from "../../engine/seed";
import { termoShareGrid } from "../../engine/share";
import type { TermoPuzzle } from "../../engine/types";
import { plainLetters } from "../../engine/words";
import { useTermoGame } from "../../hooks/use-termo-game";
import { TermoBoard, type TermoBoardView } from "../board/termo-board";
import { TermoKeyboard } from "../keyboard/termo-keyboard";
import { TermoTutorialDialog } from "../tutorial/tutorial-dialog";
import { type TermoDayMode, TermoNextModes } from "./next-modes";
import "../termo.css";

// The debug panel is compiled out of production bundles: the condition is a build-time constant.
const DebugPanel = process.env.NODE_ENV === "development" ? dynamic(() => import("./debug-panel"), { ssr: false }) : null;

const GAME = GAMES.termo;

type GameProps = {
  spec: PuzzleSpec;
  /** Present for the daily puzzle. Enables numbering, streaks and the daily result record. */
  daily?: DailyInfo;
  /** Practice only: load another puzzle with the same settings. */
  onNext?: () => void;
};

export function TermoGame({ spec, daily, onNext }: GameProps) {
  const generated = useGeneratedPuzzle(termoSeeds.format(spec), () => generateTermoFromSpec(spec));
  if (!generated || "error" in generated) return <GameLoading game={GAME} daily={daily} error={generated && "error" in generated ? generated.error : undefined} />;
  return (
    <PuzzleAttempts game="termo" puzzle={generated.puzzle} enabled={onNext !== undefined}>
      <GameView key={generated.puzzle.id} spec={spec} puzzle={generated.puzzle} generationMs={generated.generationMs} daily={daily} onNext={onNext} />
    </PuzzleAttempts>
  );
}

type ViewProps = { spec: PuzzleSpec; puzzle: TermoPuzzle; generationMs: number; daily?: DailyInfo; onNext?: () => void };

function GameView({ spec, puzzle, generationMs, daily, onNext }: ViewProps) {
  const { settings } = useSettings();
  const [showSolution, setShowSolution] = useState(false);
  const game = useTermoGame({ puzzle, settings });
  const { press, erase, clear, submit, stepCursor } = game;
  const state = game.game;
  const count = puzzle.answers.length;
  const active = game.ready && !game.locked;

  const solved = useMemo(() => solvedBoards(puzzle, state.guesses), [puzzle, state.guesses]);
  const keyStates = useMemo(() => puzzle.answers.map((answer) => letterStates(answer, state.guesses)), [puzzle, state.guesses]);
  const boards: TermoBoardView[] = puzzle.answers.map((answer, board) => ({
    rows: boardRows(puzzle, state, board),
    solved: solved[board],
    hints: hintLetters(puzzle, state, board),
    answer: game.locked && !solved[board] ? answer : null,
  }));

  const typing = state.draft.some((letter) => letter !== "");

  // The physical keyboard. It listens in the capture phase and marks what it uses as handled, so the frame's own shortcuts (Z, H) do not also fire while the player types a word.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const onControl = target !== null && (target.tagName === "BUTTON" || target.tagName === "A");
      const handle = (run: () => void) => {
        event.preventDefault();
        run();
      };
      if (event.key === "Enter") {
        // Enter plays the row, even right after a click on Hint left the focus there. With nothing typed, Enter on a focused button or link belongs to that control.
        if (typing || !onControl) handle(submit);
      } else if (event.key === "Backspace") handle(erase);
      else if (event.key === "Delete") handle(clear);
      else if (event.key === "ArrowLeft") handle(() => stepCursor(-1));
      else if (event.key === "ArrowRight") handle(() => stepCursor(1));
      else if (event.key.length === 1) {
        const letter = plainLetters(event.key);
        if (letter.length === 1) handle(() => press(letter));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, clear, erase, press, stepCursor, submit, typing]);

  // A puzzle of the day, the daily itself or the day's Dueto or Quarteto, leads on to the day's other modes once it is over.
  const variant = daily ? null : termoDailyVariantFromSpec(spec);
  const ofTheDay: { date: string; mode: TermoDayMode } | null = daily ? { date: daily.date, mode: "termo" } : variant ? { date: variant.date, mode: variant.variant } : null;

  const words = count === 1 ? "a palavra" : `as ${count} palavras`;
  const idleText = state.guesses.length === 0 ? `Descubra ${words} em ${puzzle.maxGuesses} tentativas. Digite uma palavra de 5 letras e aperte Enter.` : `Tentativa ${Math.min(state.guesses.length + 1, puzzle.maxGuesses)} de ${puzzle.maxGuesses}.`;
  const status: StatusMessage = game.status.kind === "idle" ? { kind: "idle", text: game.summary ? "" : idleText } : game.status;

  return (
    <GameFrame
      game={GAME}
      daily={daily}
      difficulty={puzzle.difficulty}
      size={TERMO_WORD_LENGTH}
      seed={puzzle.seed}
      shareUrl={() => (daily ? `${window.location.origin}${GAME.path}` : buildPlayUrl(window.location.origin, GAME.path, termoSeeds, spec))}
      shareDetail={() => termoShareGrid(puzzle, state.guesses)}
      session={game}
      idleText={idleText}
      hiddenControls={["undo", "reset"]}
      resultActions={ofTheDay ? <TermoNextModes date={ofTheDay.date} current={ofTheDay.mode} testId="termo-result-next" /> : undefined}
      onNext={onNext}
      board={
        <TermoBoard
          boards={boards}
          cursor={state.cursor}
          freshRow={game.freshRow}
          shaking={game.shaking}
          locked={!active}
          label={count === 1 ? `Termo: uma palavra de 5 letras, ${puzzle.maxGuesses} tentativas.` : `Termo: ${count} palavras de 5 letras, ${puzzle.maxGuesses} tentativas. Cada palpite vale para todas.`}
          onCell={game.placeCursor}
        />
      }
      statusSlot={
        <div className="termo-below" data-boards={count}>
          <StatusLine status={status} />
          {game.summary && ofTheDay ? (
            <TermoNextModes date={ofTheDay.date} current={ofTheDay.mode} />
          ) : (
            <TermoKeyboard states={keyStates} solved={solved} disabled={!active} onLetter={press} onErase={erase} onClear={clear} onEnter={submit} />
          )}
        </div>
      }
      tutorial={(props) => <TermoTutorialDialog {...props} />}
      debug={DebugPanel ? <DebugPanel puzzle={puzzle} generationMs={generationMs} showSolution={showSolution} onToggleSolution={setShowSolution} /> : undefined}
    />
  );
}
