"use client";

import { HintIcon, ResetIcon, RevealIcon, ShuffleIcon, UndoIcon } from "./icons";

export type HiddenControl = "undo" | "reset";

type ControlsProps = {
  canUndo: boolean;
  canReset: boolean;
  disabled: boolean;
  hintsUsed: number;
  onUndo: () => void;
  onHint: () => void;
  onReveal: () => void;
  onReset: () => void;
  /** Practice only: drop this board and start another one with the same settings. */
  onNewGame?: () => void;
  /** Controls the game does not have. The row closes up around the ones that are left. */
  hidden?: readonly HiddenControl[];
};

/** The same controls in every game, stacked icon over label so they fit a 360 px screen. Practice adds "New". */
const COLUMNS = ["", "", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5"];

export function GameControls({ canUndo, canReset, disabled, hintsUsed, onUndo, onHint, onReveal, onReset, onNewGame, hidden = [] }: ControlsProps) {
  const showUndo = !hidden.includes("undo");
  const showReset = !hidden.includes("reset");
  const count = 2 + Number(showUndo) + Number(showReset) + Number(onNewGame !== undefined);
  return (
    <div className={`mg-controls w-full grid gap-2 ${COLUMNS[count]}`} role="group" aria-label="Game controls">
      {showUndo && (
        <button type="button" className="mg-button" data-layout="stacked" onClick={onUndo} disabled={disabled || !canUndo} aria-keyshortcuts="Z">
          <UndoIcon /> Undo
        </button>
      )}
      <button type="button" className="mg-button" data-layout="stacked" onClick={onHint} disabled={disabled} aria-keyshortcuts="H" aria-label={`Hint. ${hintsUsed} used.`}>
        <HintIcon /> Hint{hintsUsed > 0 ? ` · ${hintsUsed}` : ""}
      </button>
      <button type="button" className="mg-button" data-layout="stacked" onClick={onReveal} disabled={disabled}>
        <RevealIcon /> Reveal
      </button>
      {showReset && (
        <button type="button" className="mg-button" data-layout="stacked" onClick={onReset} disabled={disabled || !canReset}>
          <ResetIcon /> Reset
        </button>
      )}
      {onNewGame && (
        // Never disabled: a new board is always available, even while this one is still loading its progress.
        <button type="button" className="mg-button" data-layout="stacked" onClick={onNewGame} aria-label="New game" data-testid="game-new">
          <ShuffleIcon /> New
        </button>
      )}
    </div>
  );
}
