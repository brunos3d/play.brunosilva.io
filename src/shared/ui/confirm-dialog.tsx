"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Dialog } from "./dialog";

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  testId?: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, confirmLabel, cancelLabel, testId = "game-confirm", children, onConfirm, onClose }: Props) {
  const t = useTranslations("common.dialog");
  return (
    <Dialog open={open} onClose={onClose} title={title} testId={testId}>
      <div className="text-[15px] leading-relaxed text-[var(--ink-soft)] mb-5">{children}</div>
      <div className="mg-actions" data-even="true">
        <button type="button" className="mg-button" onClick={onClose}>
          {cancelLabel ?? t("cancel")}
        </button>
        <button type="button" className="mg-button" data-variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
