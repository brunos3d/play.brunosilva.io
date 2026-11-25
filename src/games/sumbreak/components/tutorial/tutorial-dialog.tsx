"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import type { SumbreakState } from "../../engine/game/state";
import { useSumbreakGame } from "../../hooks/use-sumbreak-game";
import { SumbreakBoard } from "../board/sumbreak-board";
import { SUMBREAK_TUTORIAL_PUZZLE } from "./tutorial-puzzle";

/** The steps in order. Titles and bodies are in the "sumbreak" messages, under tutorial.steps.<id>. */
type Step = { id: "merge" | "order"; done: (game: SumbreakState) => boolean };

const STEPS: Step[] = [
  { id: "merge", done: (game) => game.history.length >= 1 },
  { id: "order", done: (game) => game.status === "solved" },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const t = useTranslations("sumbreak");
  const common = useTranslations("common.tutorial");
  const game = useSumbreakGame({ puzzle: SUMBREAK_TUTORIAL_PUZZLE, settings, persist: false });

  // Steps only move forward. A player who works ahead skips the steps they already satisfied.
  const [stepIndex, setStepIndex] = useState(0);
  if (stepIndex < STEPS.length && STEPS[stepIndex].done(game.game)) setStepIndex(stepIndex + 1);

  const finished = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((entry, index) => (
          <span key={entry.id} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? t("tutorial.doneTitle") : common("step", { number: stepIndex + 1, title: t(`tutorial.steps.${step.id}.title`) })}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {finished ? t("tutorial.doneBody") : t(`tutorial.steps.${step.id}.body`)}
        </p>
      </div>

      <div className="w-full max-w-[240px] mx-auto">
        <SumbreakBoard
          size={SUMBREAK_TUTORIAL_PUZZLE.size}
          tiles={game.tiles}
          lastMerge={game.lastMerge}
          hinted={game.hinted}
          locked={finished || game.locked || game.busy}
          solved={game.game.status === "solved"}
          stuck={game.stuck}
          shakeSignal={game.shakeSignal}
          refusedCell={game.refusedCell}
          label={t("board.tutorialLabel", { size: SUMBREAK_TUTORIAL_PUZZLE.size })}
          onMerge={game.merge}
        />
      </div>

      <p className="text-center text-sm min-h-[60px] text-[var(--ink-soft)]">{game.status.kind === "invalid" || game.status.kind === "hint" ? game.status.text : ""}</p>

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

export function SumbreakTutorialDialog({ open, settings, onClose }: Props) {
  const t = useTranslations("sumbreak.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
