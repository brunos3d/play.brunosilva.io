"use client";

import { useState } from "react";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import type { SumbreakState } from "../../engine/game/state";
import { useSumbreakGame } from "../../hooks/use-sumbreak-game";
import { SumbreakBoard } from "../board/sumbreak-board";
import { SUMBREAK_TUTORIAL_PUZZLE } from "./tutorial-puzzle";

type Step = { title: string; body: string; done: (game: SumbreakState) => boolean };

const STEPS: Step[] = [
  {
    title: "Merge equal neighbours",
    body: "Drag a number onto a neighbour that holds the same number, or tap one and then the other. They become one tile with their sum. Start with the two 1s.",
    done: (game) => game.history.length >= 1,
  },
  {
    title: "The order is the puzzle",
    body: "The tile you drop on keeps its place, the other cell stays empty, and nothing slides. A 2 that ends up far from the other 2 is stuck for good. Keep merging, and use Undo if you strand a tile.",
    done: (game) => game.status === "solved",
  },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
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
          <span key={entry.title} className="h-1.5 flex-1 rounded-full" style={{ background: index < stepIndex ? "var(--valid)" : index === stepIndex ? "var(--ink)" : "var(--thread)" }} />
        ))}
      </div>

      <div aria-live="polite" className="min-h-[104px]">
        <h3 className="font-bold mb-1">{finished ? "That is the whole game" : `${stepIndex + 1}. ${step.title}`}</h3>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {finished ? "One tile left, holding the sum of all the others. A merge that looks fine can still ruin the board, and the game only tells you when you get stuck or ask for a hint. The clock starts when you first see a board and only stops when it is solved." : step.body}
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
          label="Tutorial board, 3 by 3"
          onMerge={game.merge}
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

export function SumbreakTutorialDialog({ open, settings, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="How to play Sumbreak" testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
