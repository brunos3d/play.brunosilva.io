"use client";

import { HintIcon, ResetIcon, RevealIcon, UndoIcon } from "./icons";

type ControlsProps = {
  canUndo: boolean;
  canReset: boolean;
  disabled: boolean;
  hintsUsed: number;
  onUndo: () => void;
  onHint: () => void;
  onReveal: () => void;
  onReset: () => void;
};

/** The same four controls in every game, stacked icon over label so they fit a 360 px screen. */
export function GameControls({ canUndo, canReset, disabled, hintsUsed, onUndo, onHint, onReveal, onReset }: ControlsProps) {
  return (
    <div className="mg-controls w-full grid grid-cols-4 gap-2" role="group" aria-label="Game controls">
      <button type="button" className="mg-button" data-layout="stacked" onClick={onUndo} disabled={disabled || !canUndo} aria-keyshortcuts="Z">
        <UndoIcon /> Undo
      </button>
      <button type="button" className="mg-button" data-layout="stacked" onClick={onHint} disabled={disabled} aria-keyshortcuts="H" aria-label={`Hint. ${hintsUsed} used.`}>
        <HintIcon /> Hint{hintsUsed > 0 ? ` · ${hintsUsed}` : ""}
      </button>
      <button type="button" className="mg-button" data-layout="stacked" onClick={onReveal} disabled={disabled}>
        <RevealIcon /> Reveal
      </button>
      <button type="button" className="mg-button" data-layout="stacked" onClick={onReset} disabled={disabled || !canReset}>
        <ResetIcon /> Reset
      </button>
    </div>
  );
}
