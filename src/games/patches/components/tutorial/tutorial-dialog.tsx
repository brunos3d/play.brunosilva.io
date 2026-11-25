"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { GameState } from "../../engine/game/state";
import { usePatchesGame } from "../../hooks/use-patches-game";
import type { Settings } from "@/shared/storage/settings";
import { Board } from "../board/board";
import { assignPatchColors } from "../board/palette";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import { TUTORIAL_PUZZLE } from "./tutorial-puzzle";

/** The steps in order. Titles and bodies are in the "patches" messages, under tutorial.steps.<id>. */
type Step = { id: "draw" | "shapes" | "remove" | "undo" | "noNumber" | "fill"; done: (game: GameState, pending: ReadonlySet<string>) => boolean };

/** The clue has a finished patch. An unfinished one does not complete a step. */
const has = (game: GameState, clueId: string, pending: ReadonlySet<string>): boolean => game.regions.some((region) => region.clueId === clueId && !pending.has(region.id));
const present = (game: GameState, clueId: string): boolean => game.regions.some((region) => region.clueId === clueId);

const STEPS: Step[] = [
  { id: "draw", done: (game, pending) => has(game, "a", pending) },
  { id: "shapes", done: (game, pending) => has(game, "c", pending) },
  { id: "remove", done: (game) => !present(game, "c") },
  { id: "undo", done: (game, pending) => has(game, "c", pending) },
  { id: "noNumber", done: (game, pending) => has(game, "b", pending) },
  { id: "fill", done: (game) => game.status === "solved" },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const t = useTranslations("patches");
  const common = useTranslations("common.tutorial");
  const game = usePatchesGame({ puzzle: TUTORIAL_PUZZLE, settings, persist: false });
  const colors = useMemo(() => assignPatchColors(TUTORIAL_PUZZLE.clues, TUTORIAL_PUZZLE.seed), []);

  // Steps only move forward. A player who works ahead skips the steps they already satisfied.
  const [stepIndex, setStepIndex] = useState(0);
  if (stepIndex < STEPS.length && STEPS[stepIndex].done(game.game, game.pendingIds)) setStepIndex(stepIndex + 1);

  const finished = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  // The line under the board stays quiet for ordinary moves. It speaks for a refusal, a hint and the nudge to start on a clue.
  const speaks = game.status.kind === "invalid" || game.status.kind === "hint" || game.status.text === t("status.misstart");

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

      <div className="w-full max-w-[260px] mx-auto">
        <Board
          puzzle={TUTORIAL_PUZZLE}
          regions={game.game.regions}
          colors={colors}
          hint={game.hint}
          locked={finished}
          solved={game.game.status === "solved"}
          shakeSignal={game.shakeSignal}
          pendingIds={game.pendingIds}
          tweenIds={game.tweenIds}
          label={t("board.tutorialLabel", { size: TUTORIAL_PUZZLE.width })}
          previewStatus={game.previewStatus}
          onPlace={game.place}
          onRemove={game.removeAt}
          onMisstart={game.misstart}
        />
      </div>

      <p className="text-center text-sm min-h-[40px] text-[var(--ink-soft)]" data-kind={game.status.kind}>
        {speaks ? game.status.text : ""}
      </p>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          {common("start")}
        </button>
      ) : (
        <div className="patches-tutorial-actions">
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

export function TutorialDialog({ open, settings, onClose }: Props) {
  const t = useTranslations("patches.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
