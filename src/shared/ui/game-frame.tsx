"use client";

import { useTranslations } from "next-intl";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";
import type { GameMeta } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import type { DailyInfo } from "@/shared/engine/daily";
import type { Difficulty } from "@/shared/engine/difficulty";
import { useHydrated, useSettings } from "@/shared/hooks/use-settings";
import { type FinishSummary, buildResult } from "@/shared/platform/results";
import type { Settings } from "@/shared/storage/settings";
import { ConfirmDialog } from "./confirm-dialog";
import { GameControls, type HiddenControl } from "./game-controls";
import { GameFooter } from "./game-footer";
import { GameHeader } from "./game-header";
import { ClockIcon, ResetIcon, ShuffleIcon } from "./icons";
import { useRetry } from "./puzzle-attempts";
import { type ResultData, ResultDialog } from "./result-dialog";
import { SettingsDialog } from "./settings-dialog";
import { type StatusMessage, StatusLine } from "./status-line";

/** What the frame needs from a game's own hook. */
export type GameSession = {
  /** Saved progress has been read. Until then the board takes no input. */
  ready: boolean;
  /** Input is off: solved, or the solution is being revealed. */
  locked: boolean;
  elapsed: number;
  status: StatusMessage;
  hintsUsed: number;
  canUndo: boolean;
  canReset: boolean;
  /** The player has put something on the board. Leaving then asks first. Defaults to "there is something to undo or reset". */
  started?: boolean;
  /** Set once the puzzle has ended, by solving it or by revealing it. */
  summary: FinishSummary | null;
  /** True when it ended in this session. False when a finished board was reopened. */
  endedNow: boolean;
  /** The player is looking at the board. Starts the clock the first time. */
  begin: () => void;
  undo: () => void;
  reset: () => void;
  requestHint: () => void;
  reveal: () => void;
};

type FrameProps = {
  game: GameMeta;
  daily?: DailyInfo;
  difficulty: Difficulty;
  size: number;
  seed: string;
  shareUrl: () => string;
  session: GameSession;
  /** Text under the board while nothing else is being said. */
  idleText: string;
  board: ReactNode;
  /** Takes the place of the status line, for a game that talks to the player in its own way. It must announce `session.status` itself. */
  statusSlot?: ReactNode;
  tutorial: (props: { open: boolean; settings: Settings; onClose: () => void }) => ReactNode;
  debug?: ReactNode;
  onNext?: () => void;
  /** Controls that make no sense in this game. Termo has no undo and no reset: a guess is final. */
  hiddenControls?: readonly HiddenControl[];
  /** Lines the game adds to the shared result. */
  shareDetail?: () => string | undefined;
  /** The game's own links on the result screen, in place of the practice button and the suggested games. */
  resultActions?: ReactNode;
};

/** Lets the solve animation finish before the result covers the board. */
const RESULT_DELAY_MS = 1_000;

/**
 * Everything around a board that is the same in every game: header, status
 * line, the four controls, dialogs, keyboard shortcuts, the result flow and the
 * moment the clock starts.
 */
export function GameFrame({ game, daily, difficulty, size, seed, shareUrl, session, idleText, board, statusSlot, tutorial, debug, onNext, hiddenControls, shareDetail, resultActions }: FrameProps) {
  const t = useTranslations("common");
  const { settings, update, markTutorialSeen } = useSettings();
  const hydrated = useHydrated();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  // Practice only: the game's container offers to start this same puzzle over.
  const retry = useRetry();

  const tutorialOpen = helpOpen || (hydrated && !settings.tutorials[game.id]);
  const closeTutorial = () => {
    setHelpOpen(false);
    markTutorialSeen(game.id);
  };

  // The clock starts the first time the board is actually in view: progress is loaded and no tutorial covers it.
  const { ready, begin } = session;
  useEffect(() => {
    if (ready && hydrated && !tutorialOpen) begin();
  }, [ready, hydrated, tutorialOpen, begin]);

  // Result flow. A board that ended just now records its result. A reopened one only reads it.
  const { summary, endedNow } = session;
  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    let timeout = 0;
    void buildResult({ game: game.id, daily, difficulty, size, seed, summary, record: endedNow, shareUrl: shareUrl() }).then((data) => {
      if (cancelled) return;
      setResult(data);
      timeout = window.setTimeout(() => setResultOpen(true), endedNow ? RESULT_DELAY_MS : 0);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
    // Runs once per ended board. Everything else it reads is fixed for the puzzle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  // Leaving a board the player has started asks first: the clock keeps running while they are away.
  const inProgress = session.ready && !summary && (session.started ?? (session.canUndo || session.canReset));
  const handleHome = (event: MouseEvent<HTMLAnchorElement>) => {
    // A modified click opens the hub in another tab, and this one stays on the puzzle.
    if (!inProgress || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setLeaveOpen(true);
  };

  const dialogOpen = tutorialOpen || settingsOpen || resultOpen || confirmOpen || leaveOpen;
  const { undo, requestHint } = session;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (dialogOpen || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        undo();
      } else if (key === "h" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        requestHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, requestHint, undo]);

  const status: StatusMessage = session.status.kind === "idle" ? { kind: "idle", text: summary ? "" : idleText } : session.status;

  return (
    <main className="mg-shell">
      <GameHeader
        game={game}
        mode={daily ? "daily" : "practice"}
        numberLabel={daily ? `#${daily.number}` : undefined}
        difficulty={difficulty}
        size={size}
        elapsedMs={session.elapsed}
        onHelp={() => setHelpOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onHome={handleHome}
      />

      <div className="mg-stage">{board}</div>

      {statusSlot ?? <StatusLine status={status} />}

      {summary && onNext && retry ? (
        // A finished practice puzzle: look at the result, play the same board again, or move on to another one.
        <div className="mg-controls w-full grid grid-cols-3 gap-2">
          <button type="button" className="mg-button" data-layout="stacked" onClick={() => setResultOpen(true)} disabled={!result}>
            <ClockIcon /> {t("controls.viewResult")}
          </button>
          <button type="button" className="mg-button" data-layout="stacked" onClick={retry} data-testid="game-retry">
            <ResetIcon /> {t("controls.tryAgain")}
          </button>
          <button type="button" className="mg-button" data-layout="stacked" data-variant="primary" onClick={onNext} data-testid="game-new">
            <ShuffleIcon /> {t("controls.newGame")}
          </button>
        </div>
      ) : summary ? (
        <div className={`mg-controls w-full grid gap-2.5 ${onNext ? "grid-cols-2" : ""}`}>
          <button type="button" className="mg-button" data-variant={onNext ? undefined : "primary"} onClick={() => setResultOpen(true)} disabled={!result}>
            {t("controls.viewResult")}
          </button>
          {onNext && (
            <button type="button" className="mg-button" data-variant="primary" onClick={onNext} data-testid="game-new">
              <ShuffleIcon /> {t("controls.newGame")}
            </button>
          )}
        </div>
      ) : (
        <GameControls
          canUndo={session.canUndo}
          canReset={session.canReset}
          disabled={!session.ready || session.locked}
          hintsUsed={session.hintsUsed}
          onUndo={session.undo}
          onHint={session.requestHint}
          onReveal={() => setConfirmOpen(true)}
          onReset={session.reset}
          onNewGame={onNext}
          hidden={hiddenControls}
        />
      )}

      {debug}
      <GameFooter current={game.id} />

      {tutorial({ open: tutorialOpen, settings, onClose: closeTutorial })}
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onChange={update}
        onClose={() => setSettingsOpen(false)}
        onReplayTutorial={() => {
          setSettingsOpen(false);
          setHelpOpen(true);
        }}
        showGameLanguage={game.language !== undefined}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={t("reveal.title")}
        confirmLabel={t("reveal.confirm")}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          session.reveal();
        }}
      >
        {t(daily ? "reveal.daily" : "reveal.practice")}
      </ConfirmDialog>
      <ConfirmDialog
        open={leaveOpen}
        title={t("leave.title")}
        confirmLabel={t("leave.confirm")}
        testId="game-leave"
        onClose={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          router.push("/");
        }}
      >
        {t("leave.body")}
      </ConfirmDialog>
      <ResultDialog game={game} open={resultOpen} result={result} onClose={() => setResultOpen(false)} onNext={onNext} onRetry={onNext && retry ? retry : undefined} shareDetail={shareDetail} actions={resultActions} />
    </main>
  );
}
