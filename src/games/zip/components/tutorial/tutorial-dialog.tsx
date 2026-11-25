"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import type { ZipState } from "../../engine/game/state";
import { generateZipPuzzle } from "../../engine/generator";
import { useZipGame } from "../../hooks/use-zip-game";
import { pathColors } from "../board/path-colors";
import { ZipBoard } from "../board/zip-board";

/** Teaching board. It comes from the same generator as every other puzzle, under a fixed seed and a fixed generator version, because the steps below describe this exact board. */
export const ZIP_TUTORIAL_SEED = "tutorial-1";
const TUTORIAL_SIZE = 5;

/** The steps in order. Titles and bodies are in the "zip" messages, under tutorial.steps.<id>. */
type Step = { id: "draw" | "order" | "back" | "fill"; done: (game: ZipState, numberTwoCell: number) => boolean };

const STEPS: Step[] = [
  { id: "draw", done: (game) => game.path.length >= 4 },
  { id: "order", done: (game, numberTwo) => game.path.includes(numberTwo) },
  { id: "back", done: (game) => game.backtracks >= 1 },
  { id: "fill", done: (game) => game.status === "solved" },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const t = useTranslations("zip");
  const common = useTranslations("common.tutorial");
  const puzzle = useMemo(() => generateZipPuzzle(ZIP_TUTORIAL_SEED, "easy", { size: TUTORIAL_SIZE, version: 1 }), []);
  const game = useZipGame({ puzzle, settings, persist: false });
  const colors = useMemo(() => pathColors(puzzle.id, puzzle.width * puzzle.height), [puzzle]);
  const numberTwo = useMemo(() => {
    const two = puzzle.checkpoints.find((checkpoint) => checkpoint.number === 2)!;
    return two.row * puzzle.width + two.column;
  }, [puzzle]);

  // Steps only move forward. A player who works ahead skips the steps they already satisfied.
  const [stepIndex, setStepIndex] = useState(0);
  if (stepIndex < STEPS.length && STEPS[stepIndex].done(game.game, numberTwo)) setStepIndex(stepIndex + 1);

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
        <ZipBoard
          puzzle={puzzle}
          topology={game.topology}
          path={game.game.path}
          colors={colors}
          locked={finished || game.locked}
          solved={game.game.status === "solved"}
          shakeSignal={game.shakeSignal}
          refusedCell={game.refusedCell}
          wrongCells={game.wrongCells}
          missingCells={game.missingCells}
          label={t("board.tutorialLabel", { size: TUTORIAL_SIZE })}
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onKeyStep={game.keyStep}
        />
      </div>

      <p className="text-center text-sm min-h-[40px] text-[var(--ink-soft)]">{game.status.kind === "invalid" || game.status.kind === "hint" ? game.status.text : ""}</p>

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

export function ZipTutorialDialog({ open, settings, onClose }: Props) {
  const t = useTranslations("zip.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
