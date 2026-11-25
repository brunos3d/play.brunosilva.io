"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { GAME_LIST, type GameMeta, dailyVariant } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/shared/engine/clock";
import type { Difficulty } from "@/shared/engine/difficulty";
import { msUntilPacificMidnight, pacificDateKey } from "@/shared/engine/pacific-time";
import type { StreakSummary } from "@/shared/engine/streak";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGameText } from "@/shared/hooks/use-game-text";
import { buildShareText } from "@/shared/platform/share-text";
import { type ShareOutcome, share } from "@/shared/platform/sharing";
import { loadDailyResult } from "@/shared/storage/progress";
import { Dialog } from "./dialog";
import { GameIcon } from "./game-icons";
import { ArrowRightIcon, CheckIcon, FlameIcon, ResetIcon, ShareIcon, ShuffleIcon } from "./icons";

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
  /** The game was lost. It reads as its own outcome, but counts like a revealed puzzle. */
  failed?: boolean;
  /** A practice puzzle played again with "Try again". It sets no best time. */
  replay?: boolean;
  streak?: StreakSummary;
  best?: { elapsedMs: number; isNew: boolean };
  /** Absolute URL that reopens this puzzle, or the daily page. */
  shareUrl: string;
};

type Props = {
  game: GameMeta;
  open: boolean;
  result: ResultData | null;
  onClose: () => void;
  onNext?: () => void;
  /** Practice only: play this same puzzle again from the start. */
  onRetry?: () => void;
  /** Lines a game adds to its shared result, such as Termo's grid of coloured squares. */
  shareDetail?: () => string | undefined;
  /**
   * Where the game itself wants to send the player next. It takes the place of
   * the practice button and of the suggested games, so the list stays short.
   * Termo links to the day's Dueto and Quarteto here.
   */
  actions?: ReactNode;
};

/** Message key of what the share button says after a share. */
const SHARE_LABEL: Record<ShareOutcome, string> = { shared: "shared", copied: "copied", cancelled: "share", failed: "shareFailed" };
const SHARE_LABEL_RESET_MS = 2_500;
/** How many other games the result screen suggests. The rest are one tap away, on the hub. */
const SUGGESTIONS = 2;

/**
 * The other games whose daily puzzle has not been finished today, in hub
 * order, at most `SUGGESTIONS` of them. Null until storage has answered, so
 * the list never flashes games that then go away.
 */
function useSuggestedGames(current: GameMeta, open: boolean): GameMeta[] | null {
  const [suggested, setSuggested] = useState<GameMeta[] | null>(null);
  const { language } = useGameLanguage();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const today = pacificDateKey(new Date());
    const others = GAME_LIST.filter((entry) => entry.id !== current.id);
    // A game with one daily per language is open while the one in the player's game language is.
    void Promise.all(others.map((entry) => loadDailyResult(entry.id, today, dailyVariant(entry, language)).catch(() => undefined))).then((results) => {
      if (!cancelled) setSuggested(others.filter((_, index) => !results[index]).slice(0, SUGGESTIONS));
    });
    return () => {
      cancelled = true;
    };
  }, [current.id, language, open]);
  return suggested;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}

function NextPuzzleCountdown() {
  const t = useTranslations("common.result");
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
      {t.rich("nextIn", { time: () => <span className="font-semibold tabular-nums text-[var(--ink)]">{remaining === null ? "--:--:--" : formatCountdown(remaining)}</span> })}
    </p>
  );
}

/** Message key of the result's title. */
function headline(result: ResultData): string {
  if (result.failed) return "failed";
  if (result.revealed) return "revealed";
  if (result.hintsUsed === 0 && result.mistakes === 0) return "flawless";
  if (result.hintsUsed === 0) return "noHints";
  return "solved";
}

export function ResultDialog({ game, open, result, onClose, onNext, onRetry, shareDetail, actions }: Props) {
  const t = useTranslations("common.result");
  const share_ = useTranslations("common.share");
  const text = useGameText();
  const [shareLabel, setShareLabel] = useState<string | null>(null);
  const suggested = useSuggestedGames(game, open);

  useEffect(() => {
    if (shareLabel === null) return;
    const timeout = window.setTimeout(() => setShareLabel(null), SHARE_LABEL_RESET_MS);
    return () => window.clearTimeout(timeout);
  }, [shareLabel]);

  if (!result) {
    return (
      <Dialog open={false} onClose={onClose} title={t("title")}>
        {null}
      </Dialog>
    );
  }

  const isDaily = result.dailyNumber !== undefined;
  const name = text.name(game.id);
  const handleShare = async () => {
    const shared = buildShareText({
      ...result,
      size: game.hasSizes ? result.size : undefined,
      gameName: name,
      difficultyLabel: text.tier(game, result.difficulty),
      mistakesLabel: text.mistakes(game.id),
      streak: result.streak?.current,
      detail: shareDetail?.(),
      labels: { hints: share_("hints"), streak: share_("streak") },
    });
    setShareLabel(t(SHARE_LABEL[await share({ title: name, text: shared, url: result.shareUrl })]));
  };

  return (
    <Dialog open={open} onClose={onClose} title={t(headline(result))} testId="game-result">
      <p className="text-sm text-[var(--ink-soft)] -mt-2 mb-4">
        {isDaily ? t("daily", { game: name, number: result.dailyNumber ?? 0 }) : t("practice")} · <span className="capitalize">{text.tier(game, result.difficulty)}</span>
        {game.hasSizes && ` · ${result.size}×${result.size}`}
      </p>

      <div className="text-center py-3 rounded-2xl bg-[var(--linen)] mb-3">
        <div className="mg-display text-[56px] font-semibold leading-none tabular-nums" data-testid="game-result-time">
          {formatTime(result.elapsedMs)}
        </div>
        <div className="mt-2 text-sm font-semibold text-[var(--ink-soft)] flex items-center justify-center gap-1 min-h-5">
          {result.revealed ? (
            <>{t("noCredit")}</>
          ) : result.replay ? (
            <>{t("replay")}</>
          ) : result.best?.isNew ? (
            <>
              <CheckIcon className="w-4 h-4 text-[var(--valid)]" /> {t("newBest")}
            </>
          ) : result.best ? (
            <>{t("best", { time: formatTime(result.best.elapsedMs) })}</>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 mb-3">
        <div className="mg-stat"><dt>{t("hints")}</dt><dd>{result.hintsUsed}</dd></div>
        <div className="mg-stat"><dt>{text.mistakes(game.id)}</dt><dd>{result.mistakes}</dd></div>
        <div className="mg-stat"><dt>{t("moves")}</dt><dd>{result.moves}</dd></div>
      </dl>

      {result.streak && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-4 bg-[var(--linen)]">
          <div className="flex items-center gap-2 font-semibold">
            <FlameIcon className="w-5 h-5 text-[var(--accent)]" />
            <span>{t.rich("streak", { count: result.streak.current, n: (chunks) => <span data-testid="game-streak">{chunks}</span> })}</span>
          </div>
          <div className="text-sm text-[var(--ink-soft)]">{t("longest", { count: result.streak.longest })}</div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {/* A lost game is shared too: its grid says how close it came. A revealed one has nothing to show. */}
        {(!result.revealed || result.failed) && (
          <button type="button" className="mg-button" data-variant="primary" onClick={handleShare}>
            <ShareIcon /> <span aria-live="polite">{shareLabel ?? t("share")}</span>
          </button>
        )}
        {actions ??
          (isDaily ? (
            <Link href={`${game.path}/practice`} prefetch={false} className="mg-button">
              <ShuffleIcon /> {t("keepPracticing")}
            </Link>
          ) : (
            onNext && (
              <button type="button" className="mg-button" data-variant={result.revealed ? "primary" : undefined} onClick={onNext}>
                <ShuffleIcon /> {t("next")}
              </button>
            )
          ))}
        {onRetry && (
          <button type="button" className="mg-button" onClick={onRetry} data-testid="game-result-retry">
            <ResetIcon /> {t("tryAgain")}
          </button>
        )}
        {!actions &&
          suggested?.map((other) => (
            <Link key={other.id} href={other.path} prefetch={false} className="mg-button justify-between" data-testid="game-result-suggestion">
              <span className="flex items-center gap-2.5">
                <GameIcon game={other.id} className="w-7 h-7 rounded-[7px]" /> {t("playToday", { game: text.name(other.id) })}
              </span>
              <ArrowRightIcon />
            </Link>
          ))}
        {suggested && (
          <Link href="/" prefetch={false} className="mg-button justify-between" data-testid="game-result-all">
            {t(!actions && suggested.length === 0 ? "allGames" : "otherGames")} <ArrowRightIcon />
          </Link>
        )}
        {isDaily && <NextPuzzleCountdown />}
      </div>
    </Dialog>
  );
}
