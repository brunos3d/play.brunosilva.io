"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("common.controls");
  const showUndo = !hidden.includes("undo");
  const showReset = !hidden.includes("reset");
  const count = 2 + Number(showUndo) + Number(showReset) + Number(onNewGame !== undefined);
  return (
    <div className={`mg-controls w-full grid gap-2 ${COLUMNS[count]}`} role="group" aria-label={t("label")}>
      {showUndo && (
        <button type="button" className="mg-button" data-layout="stacked" data-control="undo" onClick={onUndo} disabled={disabled || !canUndo} aria-keyshortcuts="Z">
          <UndoIcon /> {t("undo")}
        </button>
      )}
      <button type="button" className="mg-button" data-layout="stacked" data-control="hint" onClick={onHint} disabled={disabled} aria-keyshortcuts="H" aria-label={t("hintUsed", { count: hintsUsed })}>
        <HintIcon /> {hintsUsed > 0 ? t("hintCount", { count: hintsUsed }) : t("hint")}
      </button>
      <button type="button" className="mg-button" data-layout="stacked" data-control="reveal" onClick={onReveal} disabled={disabled}>
        <RevealIcon /> {t("reveal")}
      </button>
      {showReset && (
        <button type="button" className="mg-button" data-layout="stacked" data-control="reset" onClick={onReset} disabled={disabled || !canReset}>
          <ResetIcon /> {t("reset")}
        </button>
      )}
      {onNewGame && (
        // Never disabled: a new board is always available, even while this one is still loading its progress.
        <button type="button" className="mg-button" data-layout="stacked" onClick={onNewGame} aria-label={t("newGame")} data-testid="game-new">
          <ShuffleIcon /> {t("new")}
        </button>
      )}
    </div>
  );
}
