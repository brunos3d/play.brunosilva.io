import { AlertIcon, CheckIcon, HintIcon } from "./icons";

export type StatusKind = "idle" | "info" | "invalid" | "hint" | "success";
export type StatusMessage = { kind: StatusKind; text: string };

export const IDLE_STATUS: StatusMessage = { kind: "idle", text: "" };

/** One line under the board. It is a live region, so every message is also spoken. */
export function StatusLine({ status }: { status: StatusMessage }) {
  return (
    <p className="mg-status" data-kind={status.kind} data-testid="game-status" role="status" aria-live="polite">
      {status.kind === "invalid" && <AlertIcon />}
      {status.kind === "hint" && <HintIcon />}
      {status.kind === "success" && <CheckIcon />}
      <span>{status.text}</span>
    </p>
  );
}
