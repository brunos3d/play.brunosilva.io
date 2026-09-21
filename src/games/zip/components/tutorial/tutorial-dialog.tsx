"use client";

import { useMemo, useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import type { ZipState } from "../../engine/game/state";
import { generateZipPuzzle } from "../../engine/generator";
import { useZipGame } from "../../hooks/use-zip-game";
import { pathColors } from "../board/path-colors";
import { ZipBoard } from "../board/zip-board";

/** Teaching board. It comes from the same generator as every other puzzle, under a fixed seed. */
export const ZIP_TUTORIAL_SEED = "tutorial-1";
const TUTORIAL_SIZE = 5;

type Step = { title: string; body: string; done: (game: ZipState, numberTwoCell: number) => boolean };

const STEPS: Step[] = [
  {
    title: "Draw the path",
    body: "The path starts on 1. Press it and drag through the cells next to it. Each cell can be used once.",
    done: (game) => game.path.length >= 4,
  },
  {
    title: "Numbers in order",
    body: "The path has to pass the numbers in order, so head for 2. The ringed number is the one you need next. Thick lines are walls, and the path cannot cross them.",
    done: (game, numberTwo) => game.path.includes(numberTwo),
  },
  {
    title: "Take it back",
    body: "Made a wrong turn? Drag backwards along the path, or tap any cell on it to cut the path there. Try it now.",
    done: (game) => game.backtracks >= 1,
  },
  {
    title: "Fill every cell",
    body: "The puzzle is solved when the path covers every cell and ends on the last number. If you get stuck in a real puzzle, Hint draws the way to the next number.",
    done: (game) => game.status === "solved",
  },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const puzzle = useMemo(() => generateZipPuzzle(ZIP_TUTORIAL_SEED, "easy", { size: TUTORIAL_SIZE }), []);
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
          <span key={entry.title} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? "That is the whole game" : `${stepIndex + 1}. ${step.title}`}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {finished ? "One path, every cell, numbers in order. The clock starts when you first see a board and only stops when it is solved." : step.body}
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
          label="Tutorial board, 5 by 5"
          onPress={game.press}
          onDrag={game.drag}
          onRelease={game.release}
          onKeyStep={game.keyStep}
        />
      </div>

      <p className="text-center text-sm min-h-[40px] text-[var(--ink-soft)]">{game.status.kind === "invalid" || game.status.kind === "hint" ? game.status.text : ""}</p>

      {finished ? (
        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          Start playing
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="mg-button" onClick={game.undo} disabled={!game.canUndo}>
            <UndoIcon /> Undo
          </button>
          <button type="button" className="mg-button" onClick={game.requestHint}>
            <HintIcon /> Hint
          </button>
          <button type="button" className="mg-button" onClick={onClose}>
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

export function ZipTutorialDialog({ open, settings, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="How to play Zip" testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
