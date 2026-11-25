"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import { MARK, type QueensState, queensOf } from "../../engine/game/state";
import { generateQueensPuzzle } from "../../engine/generator";
import type { RegionColorName } from "../../engine/text";
import { useQueensGame } from "../../hooks/use-queens-game";
import { assignRegionColors } from "../board/palette";
import { QueensBoard } from "../board/queens-board";

/** Teaching board. It comes from the same generator as every other puzzle, under a fixed seed and a fixed generator version, so it never changes. */
export const QUEENS_TUTORIAL_SEED = "tutorial-1";
const TUTORIAL_SIZE = 5;

/** The steps in order. Titles and bodies are in the "queens" messages, under tutorial.steps.<id>. */
type Step = { id: "mark" | "place" | "distance" | "fill"; done: (game: QueensState) => boolean };

const STEPS: Step[] = [
  { id: "mark", done: (game) => game.marks.includes(MARK) || queensOf(game.marks).length > 0 },
  { id: "place", done: (game) => queensOf(game.marks).length >= 1 },
  { id: "distance", done: (game) => queensOf(game.marks).length >= 2 },
  { id: "fill", done: (game) => game.status === "solved" },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const t = useTranslations("queens");
  const common = useTranslations("common.tutorial");
  const puzzle = useMemo(() => generateQueensPuzzle(QUEENS_TUTORIAL_SEED, "easy", { size: TUTORIAL_SIZE, version: 1 }), []);
  const colors = useMemo(() => assignRegionColors(puzzle, puzzle.id), [puzzle]);
  const regionColor = useCallback<RegionColorName>((region) => t(`color.${colors[region].name}`), [colors, t]);
  const game = useQueensGame({ puzzle, settings, persist: false, regionColor });

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

      <div className="w-full max-w-[270px] mx-auto">
        <QueensBoard
          puzzle={puzzle}
          topology={game.topology}
          marks={game.game.marks}
          colors={colors}
          locked={finished || game.locked}
          solved={game.game.status === "solved"}
          shakeSignal={game.shakeSignal}
          refused={game.refused}
          wrongCells={game.wrongCells}
          hintCells={game.hintCells}
          hintTargets={game.hintTargets}
          label={t("board.tutorialLabel", { size: TUTORIAL_SIZE })}
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onKeyCycle={game.keyCycle}
          onKeyClear={game.keyClear}
        />
      </div>

      <p className="text-center text-sm min-h-[60px] text-[var(--ink-soft)]">{game.status.kind === "invalid" || game.status.kind === "hint" ? game.status.text : ""}</p>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          {common("start")}
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
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

export function QueensTutorialDialog({ open, settings, onClose }: Props) {
  const t = useTranslations("queens.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
