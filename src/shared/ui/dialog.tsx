"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { CloseIcon } from "@/shared/ui/icons";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hides the close button and ignores Escape and backdrop taps. */
  modalOnly?: boolean;
  testId?: string;
  children: ReactNode;
};

/** Native <dialog>: focus trap, Escape handling and inert background come from the browser. */
export function Dialog({ open, onClose, title, modalOnly = false, testId, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the dialog itself, which reads its label aloud, instead of ringing the close button.
      dialog.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="mg-dialog"
      tabIndex={-1}
      aria-label={title}
      data-testid={testId}
      onClose={onClose}
      onCancel={(event) => {
        if (modalOnly) event.preventDefault();
      }}
      onClick={(event) => {
        if (!modalOnly && event.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="mg-display text-2xl font-semibold leading-tight">{title}</h2>
            {!modalOnly && (
              <button type="button" className="mg-icon-button -mr-2 -mt-2" aria-label="Close" onClick={onClose}>
                <CloseIcon />
              </button>
            )}
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
