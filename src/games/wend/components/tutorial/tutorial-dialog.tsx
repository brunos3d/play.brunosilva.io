"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { GameLanguage } from "@/i18n/game-language";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import { type WendState, foundWords } from "../../engine/game/state";
import { useWendGame } from "../../hooks/use-wend-game";
import { wordColors } from "../board/palette";
import { WendBoard } from "../board/wend-board";
import { WendWordList } from "../board/word-list";
import { wendTutorial } from "./tutorial-puzzle";

/** The steps in order. Titles and bodies are in the "wend" messages, under tutorial.steps.<id>. */
type Step = { id: "trace" | "turn"; done: (game: WendState) => boolean };

const STEPS: Step[] = [
  { id: "trace", done: (game) => foundWords(game).length >= 1 },
  { id: "turn", done: (game) => game.status === "solved" },
];

type Props = {
  open: boolean;
  settings: Settings;
  /** The language of the tutorial's words: the one of the puzzle it opens over. The sentences follow the interface. */
  language: GameLanguage;
  onClose: () => void;
};

function TutorialBody({ settings, language, onClose }: Omit<Props, "open">) {
  const t = useTranslations("wend");
  const common = useTranslations("common.tutorial");
  const { puzzle, theme } = wendTutorial(language);
  const game = useWendGame({ puzzle, settings, persist: false });
  const colors = useMemo(() => wordColors(puzzle.id, puzzle.words.length), [puzzle]);

  // Steps only move forward. A player who works ahead skips the steps they already satisfied.
  const [stepIndex, setStepIndex] = useState(0);
  if (stepIndex < STEPS.length && STEPS[stepIndex].done(game.game)) setStepIndex(stepIndex + 1);

  const finished = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  // The sentences name the words on the board and the letters they start on, whatever language those are in.
  const [short, long] = puzzle.words;
  const body = step.id === "trace" ? t("tutorial.steps.trace.body", { letter: short.display[0], word: short.display }) : t("tutorial.steps.turn.body", { count: long.text.length, letter: long.display[0] });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((entry, index) => (
          <span key={entry.id} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? t("tutorial.doneTitle") : common("step", { number: stepIndex + 1, title: t(`tutorial.steps.${step.id}.title`) })}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{finished ? t("tutorial.doneBody") : body}</p>
      </div>

      <div className="w-full max-w-[220px] mx-auto wend-stage">
        <WendBoard
          shape={puzzle}
          trails={game.game.trails}
          active={game.game.active}
          colors={colors}
          locked={finished || game.locked || game.busy}
          solved={game.game.status === "solved"}
          hintCell={game.hintCell}
          foundSignal={game.foundSignal}
          label={t("board.tutorialLabel", { size: puzzle.size })}
          testId="wend-tutorial-board"
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onTap={game.tap}
          onBack={game.back}
        />
        <WendWordList shape={puzzle} state={game.game} colors={colors} theme={theme} themeShown />
      </div>

      <p className="text-center text-sm min-h-[40px] text-[var(--ink-soft)]">{game.status.kind === "hint" || game.status.kind === "info" ? game.status.text : ""}</p>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          {common("start")}
        </button>
      ) : (
        <div className="mg-tutorial-actions">
          <button type="button" className="mg-button" onClick={game.undo} disabled={!game.canUndo}>
            <UndoIcon /> {common("undo")}
          </button>
          <button type="button" className="mg-button" onClick={game.requestHint}>
            <HintIcon /> {common("hint")}
          </button>
          <button type="button" className="mg-button" onClick={onClose}>
            {common("skip")}
          </button>
        </div>
      )}
    </div>
  );
}

export function WendTutorialDialog({ open, settings, language, onClose }: Props) {
  const t = useTranslations("wend.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      {/* A board in another language is another tutorial: it starts from its first step. */}
      <TutorialBody key={language} settings={settings} language={language} onClose={onClose} />
    </Dialog>
  );
}
