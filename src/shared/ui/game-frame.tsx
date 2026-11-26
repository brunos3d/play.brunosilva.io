"use client";

import { useTranslations } from "next-intl";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import type { GameMeta } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import type { DailyInfo } from "@/shared/engine/daily";
import type { Difficulty } from "@/shared/engine/difficulty";
import { useHydrated, useSettings } from "@/shared/hooks/use-settings";
import { online as api } from "@/shared/online/api";
import { dailyUnavailable } from "@/shared/online/daily-sync";
import { RaceBar } from "@/shared/online/race-bar";
import type { ScoreSubmission } from "@/shared/online/types";
import { useRace } from "@/shared/online/use-race";
import { useScoreSubmission } from "@/shared/online/use-score";
import { type FinishSummary, buildResult } from "@/shared/platform/results";
import { loadBoard } from "@/shared/storage/progress";
import type { Settings } from "@/shared/storage/settings";
import { ConfirmDialog } from "./confirm-dialog";
import { useDailyBoardId } from "./daily-gate";
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
/** How often a confirmed reveal is asked again while the game is busy, and when to stop asking. */
const REVEAL_RETRY_MS = 100;
const REVEAL_GIVE_UP_MS = 5_000;
/** How long a locked board is watched before its reveal is reported. Longer than the last step of any hint. */
const REVEAL_REPORT_AFTER_MS = 600;

/**
 * Everything around a board that is the same in every game: header, status
 * line, the four controls, dialogs, keyboard shortcuts, the result flow and the
 * moment the clock starts.
 */
export function GameFrame({ game, daily, difficulty, size, seed, shareUrl, session, idleText, board, statusSlot, tutorial, debug, onNext, hiddenControls, shareDetail, resultActions }: FrameProps) {
  const t = useTranslations("common");
  const online = useTranslations("online.race");
  const { settings, update, markTutorialSeen } = useSettings();
  const hydrated = useHydrated();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  // A round of a challenge room: the puzzle is played as usual, and the room hears when it comes into view and when it ends.
  const race = useRace();
  const [raceDialogOpen, setRaceDialogOpen] = useState(false);
  // Practice only: the game's container offers to start this same puzzle over. A round of a race is played once, and its next board is the room's to pick.
  const retryOffer = useRetry();
  const retry = race ? null : retryOffer;
  const next = race ? undefined : onNext;
  const submitScore = useScoreSubmission();

  const { summary, endedNow } = session;
  // A board that is reopened finished has a result to show, not rules to explain. That happens on a device that has never
  // seen the game, when the player closed the daily on another one.
  // It waits for the board to be read, which is when a finished one is known to be finished.
  const tutorialOpen = helpOpen || (hydrated && session.ready && !settings.tutorials[game.id] && !(summary && !endedNow));
  const closeTutorial = () => {
    setHelpOpen(false);
    markTutorialSeen(game.id);
  };

  // The clock starts the first time the board is actually in view: progress is loaded and no tutorial covers it.
  const { ready, begin } = session;
  const viewRace = race?.view;
  useEffect(() => {
    if (!ready || !hydrated || tutorialOpen) return;
    begin();
    viewRace?.();
  }, [ready, hydrated, tutorialOpen, begin, viewRace]);

  // The server hears that the daily is open, and of every hint taken on it. Its clock for the puzzle starts with the first
  // such call from any device of the player, so thinking on one device and finishing on another counts the whole time.
  const dailyOpen = Boolean(daily) && !race && ready && hydrated && !tutorialOpen && !summary;
  const hintsUsed = session.hintsUsed;
  useEffect(() => {
    if (!dailyOpen || !daily || dailyUnavailable()) return;
    void api.openDaily({ game: game.id, variant: daily.variant, date: daily.date, hints: hintsUsed }).catch(() => undefined);
    // `daily` is a new object on every render of the game. Its seed says whether it is another puzzle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyOpen, daily?.seed, game.id, hintsUsed]);

  // The fields of a close that the frame knows before the game has ended.
  const closing = (elapsedMs: number, hints: number): ScoreSubmission => ({
    game: game.id,
    variant: daily?.variant,
    date: daily?.date ?? "",
    number: daily?.number ?? 0,
    difficulty,
    size,
    // The server takes no close under a second, and a reveal can be asked for the moment the board appears.
    elapsedMs: Math.max(elapsedMs, 1_000),
    hintsUsed: hints,
    mistakes: 0,
  });

  // Result flow. A board that ended just now records its result. A reopened one only reads it.
  const boardId = useDailyBoardId();
  useEffect(() => {
    // A round of a race has no result screen of its own: the room keeps the times, and the next board follows at once.
    if (!summary || race) return;
    let cancelled = false;
    let timeout = 0;
    void buildResult({ game: game.id, daily, difficulty, size, seed, summary, record: endedNow, shareUrl: shareUrl() }).then((data) => {
      if (cancelled) return;
      setResult(data);
      timeout = window.setTimeout(() => setResultOpen(true), endedNow ? RESULT_DELAY_MS : 0);
      // A daily closed just now is reported to the server, however it ended, with the finished board. A solve goes to the
      // ranking. A reveal or a loss only closes the day, on every device of the player.
      if (daily && endedNow) {
        void (async () => {
          const board = boardId ? await loadBoard(game.id, boardId) : undefined;
          const finished = typeof (board as { finishedMs?: unknown } | undefined)?.finishedMs === "number";
          // The counts are the game's own. What is stored may already be the server's record of a reveal, which came before they were known.
          const answer = await submitScore({ ...closing(data.elapsedMs, data.hintsUsed), mistakes: summary.mistakes, moves: summary.moves, revealed: data.revealed, failed: data.failed === true, ...(finished ? { board } : {}) });
          if (cancelled || !answer?.record) return;
          // The server's record is the result now: it has the points, and it is another device's close when one got there first.
          const stored = await buildResult({ game: game.id, daily, difficulty, size, seed, summary, record: false, shareUrl: shareUrl() });
          // A best time set a moment ago is still new, though the second look at storage finds it already there.
          if (!cancelled) setResult((current) => (current?.best?.isNew && stored.best ? { ...stored, best: { ...stored.best, isNew: true } } : stored));
        })();
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
    // Runs once per ended board. Everything else it reads is fixed for the puzzle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  // Race flow. The round is reported once the room knows who is asking. A board that was already reported, reopened with the
  // back button or after a reload, is not played twice: the player is sent on to where they belong.
  const raceKnowsPlayer = Boolean(race?.you);
  const roundPlayed = Boolean(race?.you && race.you.results.length > race.round);
  // The latest race and round state, for the timeout below: it must fire once per ended round, whatever re-renders in between.
  const raceRef = useRef({ race, roundPlayed });
  useEffect(() => {
    raceRef.current = { race, roundPlayed };
  });
  useEffect(() => {
    if (!summary || !raceKnowsPlayer) return;
    const timeout = window.setTimeout(() => {
      const current = raceRef.current;
      if (current.roundPlayed) current.race?.moveOn();
      else current.race?.finishRound({ solved: !summary.revealed, hints: summary.hintsUsed });
    }, RESULT_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [summary, raceKnowsPlayer]);

  // A confirmed reveal is asked of the game until the board locks. A game refuses a reveal while a hint is still drawing,
  // which takes up to a second and a half, and a confirmation given in that pause would otherwise do nothing at all.
  const [revealWanted, setRevealWanted] = useState(false);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });
  /**
   * A reveal of a daily closes the day a moment after the board locks, not when the solution has finished playing: a
   * player who closes the tab halfway has seen it all the same. The finished board follows with the result.
   */
  const reportReveal = () => {
    if (!daily || race) return;
    void submitScore({ ...closing(sessionRef.current.elapsed, sessionRef.current.hintsUsed), revealed: true });
  };
  const reportRevealRef = useRef(reportReveal);
  useEffect(() => {
    reportRevealRef.current = reportReveal;
  });
  useEffect(() => {
    if (!revealWanted) return;
    const stop = () => setRevealWanted(false);
    let lockedAt: number | null = null;
    const interval = window.setInterval(() => {
      if (!sessionRef.current.locked) {
        sessionRef.current.reveal();
        return;
      }
      // The board locked. That is the reveal, unless the hint that was still playing solved the puzzle first: a game may
      // lock on the last cell and only say "solved" a step later, so the report waits a moment for that.
      lockedAt ??= Date.now();
      const solved = sessionRef.current.summary?.revealed === false;
      if (!solved && Date.now() - lockedAt < REVEAL_REPORT_AFTER_MS) return;
      stop();
      if (!solved) reportRevealRef.current();
    }, REVEAL_RETRY_MS);
    // No pause is this long. Past it the board is in a state the reveal does not apply to.
    const timeout = window.setTimeout(stop, REVEAL_GIVE_UP_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [revealWanted]);

  // Leaving a board the player has started asks first: the clock keeps running while they are away.
  const inProgress = session.ready && !summary && (session.started ?? (session.canUndo || session.canReset));
  const handleHome = (event: MouseEvent<HTMLAnchorElement>) => {
    // A modified click opens the hub in another tab, and this one stays on the puzzle.
    if (!inProgress || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setLeaveOpen(true);
  };

  const dialogOpen = tutorialOpen || settingsOpen || resultOpen || confirmOpen || leaveOpen || raceDialogOpen;
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
    <main className="mg-shell" data-race={race ? "true" : undefined}>
      <div className="mg-header w-full flex flex-col gap-2">
        {race && <RaceBar race={race} onOpenChange={setRaceDialogOpen} />}
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
      </div>

      <div className="mg-stage">{board}</div>

      {statusSlot ?? <StatusLine status={status} />}

      {summary && race ? (
        // The round is over and the room is being told. The next board, or the table, opens by itself.
        <p className="mg-status mg-controls" data-kind="success" role="status" data-testid="race-saving">
          {online(roundPlayed && !endedNow ? "alreadyPlayed" : race.room && race.round + 1 >= race.room.rounds.length ? "raceSaved" : "roundSaved")}
        </p>
      ) : summary && next && retry ? (
        // A finished practice puzzle: look at the result, play the same board again, or move on to another one.
        <div className="mg-controls w-full grid grid-cols-3 gap-2">
          <button type="button" className="mg-button" data-layout="stacked" onClick={() => setResultOpen(true)} disabled={!result}>
            <ClockIcon /> {t("controls.viewResult")}
          </button>
          <button type="button" className="mg-button" data-layout="stacked" onClick={retry} data-testid="game-retry">
            <ResetIcon /> {t("controls.tryAgain")}
          </button>
          <button type="button" className="mg-button" data-layout="stacked" data-variant="primary" onClick={next} data-testid="game-new">
            <ShuffleIcon /> {t("controls.newGame")}
          </button>
        </div>
      ) : summary ? (
        <div className={`mg-controls w-full grid gap-2.5 ${next ? "grid-cols-2" : ""}`}>
          <button type="button" className="mg-button" data-variant={next ? undefined : "primary"} onClick={() => setResultOpen(true)} disabled={!result}>
            {t("controls.viewResult")}
          </button>
          {next && (
            <button type="button" className="mg-button" data-variant="primary" onClick={next} data-testid="game-new">
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
          onNewGame={next}
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
        title={race ? online("revealTitle") : t("reveal.title")}
        confirmLabel={race ? online("revealConfirm") : t("reveal.confirm")}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          session.reveal();
          setRevealWanted(true);
        }}
      >
        {race ? online("revealBody") : t(daily ? "reveal.daily" : "reveal.practice")}
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
      <ResultDialog game={game} open={resultOpen} result={result} onClose={() => setResultOpen(false)} onNext={next} onRetry={next && retry ? retry : undefined} shareDetail={shareDetail} actions={resultActions} />
    </main>
  );
}
