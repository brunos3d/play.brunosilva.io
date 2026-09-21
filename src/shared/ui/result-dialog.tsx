"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameMeta } from "@/games/registry";
import { GAME_LIST } from "@/games/registry";
import { formatTime } from "@/shared/engine/clock";
import type { Difficulty } from "@/shared/engine/difficulty";
import { msUntilPacificMidnight } from "@/shared/engine/pacific-time";
import type { StreakSummary } from "@/shared/engine/streak";
import { buildShareText } from "@/shared/platform/share-text";
import { type ShareOutcome, share } from "@/shared/platform/sharing";
import { Dialog } from "./dialog";
import { GameIcon } from "./game-icons";
import { ArrowRightIcon, CheckIcon, FlameIcon, ShareIcon, ShuffleIcon } from "./icons";

export type ResultData = {
  dailyNumber?: number;
  difficulty: Difficulty;
  size: number;
  elapsedMs: number;
  hintsUsed: number;
  mistakes: number;
  moves: number;
  /** The player asked for the solution. No best time, no streak credit, nothing to share. */
  revealed: boolean;
  streak?: StreakSummary;
  best?: { elapsedMs: number; isNew: boolean };
  /** Absolute URL that reopens this puzzle, or the daily page. */
  shareUrl: string;
};

type Props = { game: GameMeta; open: boolean; result: ResultData | null; onClose: () => void; onNext?: () => void };

const SHARE_LABEL: Record<ShareOutcome, string> = { shared: "Shared", copied: "Copied to clipboard", cancelled: "Share result", failed: "Could not share" };
const SHARE_LABEL_RESET_MS = 2_500;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}

function NextPuzzleCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(msUntilPacificMidnight(new Date()));
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);
  return (
    <p className="text-center text-sm text-[var(--ink-soft)]" data-testid="game-next-countdown">
      Next puzzle in <span className="font-semibold tabular-nums text-[var(--ink)]">{remaining === null ? "--:--:--" : formatCountdown(remaining)}</span>
    </p>
  );
}

function headline(result: ResultData): string {
  if (result.revealed) return "Solution revealed";
  if (result.hintsUsed === 0 && result.mistakes === 0) return "Flawless";
  if (result.hintsUsed === 0) return "Solved without hints";
  return "Solved";
}

export function ResultDialog({ game, open, result, onClose, onNext }: Props) {
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  useEffect(() => {
    if (shareLabel === null) return;
    const timeout = window.setTimeout(() => setShareLabel(null), SHARE_LABEL_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [shareLabel]);

  if (!result) {
    return (
      <Dialog open={false} onClose={onClose} title="Result">
        {null}
      </Dialog>
    );
  }

  const isDaily = result.dailyNumber !== undefined;
  const others = GAME_LIST.filter((entry) => entry.id !== game.id);
  const handleShare = async () => {
    const text = buildShareText({ ...result, gameName: game.name, mistakesLabel: game.mistakesLabel, streak: result.streak?.current });
    setShareLabel(SHARE_LABEL[await share({ title: game.name, text, url: result.shareUrl })]);
  };

  return (
    <Dialog open={open} onClose={onClose} title={headline(result)} testId="game-result">
      <p className="text-sm text-[var(--ink-soft)] -mt-2 mb-4">
        {isDaily ? `${game.name} #${result.dailyNumber}` : "Practice puzzle"} · <span className="capitalize">{result.difficulty}</span> · {result.size}×{result.size}
      </p>

      <div className="text-center py-3 rounded-2xl bg-[var(--linen)] mb-3">
        <div className="mg-display text-[56px] font-semibold leading-none tabular-nums" data-testid="game-result-time">
          {formatTime(result.elapsedMs)}
        </div>
        <div className="mt-2 text-sm font-semibold text-[var(--ink-soft)] flex items-center justify-center gap-1 min-h-5">
          {result.revealed ? (
            <>This one does not count toward your streak or best time.</>
          ) : result.best?.isNew ? (
            <>
              <CheckIcon className="w-4 h-4 text-[var(--valid)]" /> New personal best
            </>
          ) : result.best ? (
            <>Personal best {formatTime(result.best.elapsedMs)}</>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 mb-3">
        <div className="mg-stat"><dt>Hints</dt><dd>{result.hintsUsed}</dd></div>
        <div className="mg-stat"><dt>{game.mistakesLabel}</dt><dd>{result.mistakes}</dd></div>
        <div className="mg-stat"><dt>Moves</dt><dd>{result.moves}</dd></div>
      </dl>

      {result.streak && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-4 bg-[var(--linen)]">
          <div className="flex items-center gap-2 font-semibold">
            <FlameIcon className="w-5 h-5 text-[var(--accent)]" />
            <span data-testid="game-streak">{result.streak.current}</span> day streak
          </div>
          <div className="text-sm text-[var(--ink-soft)]">Longest {result.streak.longest}</div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {!result.revealed && (
          <button type="button" className="mg-button" data-variant="primary" onClick={handleShare}>
            <ShareIcon /> <span aria-live="polite">{shareLabel ?? "Share result"}</span>
          </button>
        )}
        {isDaily ? (
          <Link href={`${game.path}/practice`} prefetch={false} className="mg-button">
            <ShuffleIcon /> Keep playing in Practice
          </Link>
        ) : (
          onNext && (
            <button type="button" className="mg-button" data-variant={result.revealed ? "primary" : undefined} onClick={onNext}>
              <ShuffleIcon /> Next puzzle
            </button>
          )
        )}
        {others.map((other) => (
          <Link key={other.id} href={other.path} prefetch={false} className="mg-button justify-between">
            <span className="flex items-center gap-2.5">
              <GameIcon game={other.id} className="w-7 h-7 rounded-[7px]" /> Play today&apos;s {other.name}
            </span>
            <ArrowRightIcon />
          </Link>
        ))}
        {isDaily && <NextPuzzleCountdown />}
      </div>
    </Dialog>
  );
}
