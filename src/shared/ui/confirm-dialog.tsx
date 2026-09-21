"use client";

import type { ReactNode } from "react";
import { Dialog } from "./dialog";

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, confirmLabel, children, onConfirm, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={title} testId="game-confirm">
      <div className="text-[15px] leading-relaxed text-[var(--ink-soft)] mb-5">{children}</div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="mg-button" onClick={onClose}>
          Keep playing
        </button>
        <button type="button" className="mg-button" data-variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
