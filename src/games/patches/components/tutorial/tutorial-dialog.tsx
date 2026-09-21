"use client";

import { useMemo, useState } from "react";
import type { GameState } from "../../engine/game/state";
import { usePatchesGame } from "../../hooks/use-patches-game";
import type { Settings } from "@/shared/storage/settings";
import { Board } from "../board/board";
import { assignPatchColors } from "../board/palette";
import { Dialog } from "@/shared/ui/dialog";
import { HintIcon, UndoIcon } from "@/shared/ui/icons";
import { TUTORIAL_PUZZLE } from "./tutorial-puzzle";

type Step = { title: string; body: string; done: (game: GameState) => boolean };

const has = (game: GameState, clueId: string): boolean => game.regions.some((region) => region.clueId === clueId);

const STEPS: Step[] = [
  {
    title: "Draw a patch",
    body: "Every patch is a rectangle with exactly one clue inside. The 4 in a square outline means a square of 4 cells. Press the 4 and drag outward to draw it.",
    done: (game) => has(game, "a"),
  },
  {
    title: "Shapes",
    body: "A tall outline means taller than wide. This clue wants 6 cells, 2 wide and 3 high. Press the 6, drag up and left, then down. The patch keeps what you already covered.",
    done: (game) => has(game, "c"),
  },
  {
    title: "Remove a patch",
    body: "Changed your mind? Tap a patch to remove it. Tap the tall patch you just drew.",
    done: (game) => !has(game, "c"),
  },
  {
    title: "Undo",
    body: "Undo reverts your last move, including a removal. Press Undo to bring the patch back.",
    done: (game) => has(game, "c"),
  },
  {
    title: "No number",
    body: "The wide outline has no number, so the size is up to you. Patches cannot overlap or swallow a second clue. Only one wide rectangle fits here.",
    done: (game) => has(game, "b"),
  },
  {
    title: "Fill the board",
    body: "A dashed outline accepts any rectangle. Every cell must be covered, so the space that is left gives the answer. If you get stuck in a real puzzle, Hint places the next patch for you.",
    done: (game) => game.status === "solved",
  },
];

type Props = { open: boolean; settings: Settings; onClose: () => void };

function TutorialBody({ settings, onClose }: Omit<Props, "open">) {
  const game = usePatchesGame({ puzzle: TUTORIAL_PUZZLE, settings, persist: false });
  const colors = useMemo(() => assignPatchColors(TUTORIAL_PUZZLE.clues, TUTORIAL_PUZZLE.seed), []);

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
          {finished ? "One clue per patch, no overlaps, no empty cells. The clock starts when you first see a board and only stops when it is solved." : step.body}
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
          tweenIds={game.tweenIds}
          label="Tutorial board, 4 by 4"
          previewStatus={game.previewStatus}
          onPlace={game.place}
          onRemove={game.removeAt}
          onMisstart={game.misstart}
        />
      </div>

      <p className="text-center text-sm min-h-[40px] text-[var(--ink-soft)]" data-kind={game.status.kind}>
        {game.status.kind === "invalid" || game.status.kind === "hint" || game.status.text.startsWith("Start on a clue") ? game.status.text : ""}
      </p>

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

export function TutorialDialog({ open, settings, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="How to play Patches" testId="game-tutorial">
      <TutorialBody settings={settings} onClose={onClose} />
    </Dialog>
  );
}
