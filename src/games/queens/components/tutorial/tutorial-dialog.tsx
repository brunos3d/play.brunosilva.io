"use client";

import { useMemo, useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import { MARK, type QueensState, queensOf } from "../../engine/game/state";
import { generateQueensPuzzle } from "../../engine/generator";
import type { UnitNamer } from "../../engine/hint";
import { useQueensGame } from "../../hooks/use-queens-game";
import { assignRegionColors } from "../board/palette";
import { QueensBoard } from "../board/queens-board";

/** Teaching board. It comes from the same generator as every other puzzle, under a fixed seed and a fixed generator version, so it never changes. */
export const QUEENS_TUTORIAL_SEED = "tutorial-1";
const TUTORIAL_SIZE = 5;

type Step = { title: string; body: string; done: (game: QueensState) => boolean };

const STEPS: Step[] = [
  {
    title: "Mark a cell",
    body: "Tap a cell once to mark it with an X. It is a note to yourself: no queen goes there. Drag across cells to mark several at once.",
    done: (game) => game.marks.includes(MARK) || queensOf(game.marks).length > 0,
  },
  {
    title: "Place a queen",
    body: "Tap a marked cell again and it becomes a queen. Every row, every column and every coloured region takes exactly one queen.",
    done: (game) => queensOf(game.marks).length >= 1,
  },
  {
    title: "Queens keep their distance",
    body: "Two queens can never touch, not even at a corner. The small dots show every cell a queen has ruled out. Place a second queen.",
    done: (game) => queensOf(game.marks).length >= 2,
  },
  {
    title: "Fill the board",
    body: "Place the remaining queens. A third tap removes a queen. If you get stuck, Hint finds the next step and says why it holds.",
    done: (game) => game.status === "solved",
  },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const puzzle = useMemo(() => generateQueensPuzzle(QUEENS_TUTORIAL_SEED, "easy", { size: TUTORIAL_SIZE, version: 1 }), []);
  const colors = useMemo(() => assignRegionColors(puzzle, puzzle.id), [puzzle]);
  const nameUnit = useMemo<UnitNamer>(() => (unit) => (unit.kind === "region" ? `the ${colors[unit.index].name} region` : `${unit.kind} ${unit.index + 1}`), [colors]);
  const game = useQueensGame({ puzzle, settings, persist: false, nameUnit });

  // Steps only move forward. A player who works ahead skips the steps they already satisfied.
  const [stepIndex, setStepIndex] = useState(0);
  if (stepIndex < STEPS.length && STEPS[stepIndex].done(game.game)) setStepIndex(stepIndex + 1);

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
          {finished ? "One queen per row, column and region, and no two queens touching. Every board has exactly one answer and can be solved without guessing. The clock starts when you first see a board and only stops when it is solved." : step.body}
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
          label="Tutorial board, 5 by 5"
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

export function QueensTutorialDialog({ open, settings, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="How to play Queens" testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
