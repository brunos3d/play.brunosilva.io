"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode, createContext, useContext, useEffect, useState } from "react";
import type { GameMeta } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/shared/engine/clock";
import type { DailyInfo } from "@/shared/engine/daily";
import { ClockStartContext } from "@/shared/hooks/use-game-clock";
import { useGameText } from "@/shared/hooks/use-game-text";
import { SYNC_WAIT_MS, firstOpenedAt, syncDaily } from "@/shared/online/daily-sync";
import { type DailyResult, loadBoard, loadDailyResult } from "@/shared/storage/progress";
import { GameFooter } from "./game-footer";
import { GameHeader } from "./game-header";
import { GameLoading } from "./game-loading";
import { ArrowRightIcon, CheckIcon, RevealIcon, ShuffleIcon, TrophyIcon } from "./icons";

/** The id the daily on screen stores its board under. The frame reads it to send the finished board along with the result. */
const DailyBoardContext = createContext<string | null>(null);
export const useDailyBoardId = (): string | null => useContext(DailyBoardContext);

/** `turn` counts how many times the game was built: a daily closed elsewhere while it was on screen is built again, from the finished board. */
type Gate = { state: "waiting" } | { state: "open"; firstOpened: number | null; turn: number } | { state: "closed"; result: DailyResult };

/**
 * What stands between a player and a daily puzzle. A daily counts once per
 * player, on whichever device they close it, so before the board is shown the
 * device asks the server how the player's dailies stand (see daily-sync.ts).
 *
 * - Closed here or on another device, with the finished board at hand: the
 *   game opens it as it opens any finished board.
 * - Closed on another device that never sent its board: there is nothing to
 *   show and nothing to play. The page says how the daily went.
 * - Open: the game starts, with the clock counted from the first time any
 *   device of the player opened it.
 *
 * The games read storage once, when they mount, so the gate has to be passed
 * before that. A sync that does not answer in time lets the game through: the
 * server refuses a second close whatever the device shows.
 */
export function DailyGate({ game, daily, puzzleId, children }: { game: GameMeta; daily: DailyInfo; puzzleId: string; children: ReactNode }) {
  const [gate, setGate] = useState<Gate>({ state: "waiting" });

  useEffect(() => {
    let cancelled = false;
    // Set once the wait ran out and the game was let through without an answer: whether the day was closed then.
    let impatient: { closed: boolean } | null = null;
    const decide = async () => {
      const [result, board] = await Promise.all([loadDailyResult(game.id, daily.date, daily.variant), loadBoard(game.id, puzzleId)]);
      if (cancelled) return Boolean(result);
      const finished = typeof (board as { finishedMs?: unknown } | undefined)?.finishedMs === "number";
      const firstOpened = firstOpenedAt(game.id, daily.variant, daily.date);
      if (result && !finished) setGate({ state: "closed", result });
      else if (!impatient) setGate({ state: "open", firstOpened, turn: 0 });
      // An answer that comes after the game is on screen only matters when it closes the day. Then the game is built
      // again and opens the finished board the sync brought. Anything else would rebuild a board the player is in the
      // middle of.
      else if (result && !impatient.closed) setGate((current) => (current.state === "open" ? { state: "open", firstOpened, turn: current.turn + 1 } : current));
      return Boolean(result);
    };
    const timeout = window.setTimeout(() => {
      void decide().then((closed) => {
        impatient = { closed };
      });
    }, SYNC_WAIT_MS);
    void syncDaily().then(() => {
      window.clearTimeout(timeout);
      void decide();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
    // One decision per daily on screen: the parent gives each daily its own gate through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gate.state === "waiting") return <GameLoading game={game} daily={daily} />;
  if (gate.state === "closed") return <DailyClosed game={game} daily={daily} result={gate.result} />;
  return (
    <DailyBoardContext.Provider value={puzzleId}>
      <ClockStartContext.Provider value={gate.firstOpened}>
        <Fragment key={gate.turn}>{children}</Fragment>
      </ClockStartContext.Provider>
    </DailyBoardContext.Provider>
  );
}

/** A daily the player closed on another device, with no board to show for it on this one. */
function DailyClosed({ game, daily, result }: { game: GameMeta; daily: DailyInfo; result: DailyResult }) {
  const t = useTranslations("common.closed");
  const ranking = useTranslations("online.ranking");
  const text = useGameText();
  const outcome = result.failed ? "failed" : result.revealed ? "revealed" : "solved";
  return (
    <main className="mg-shell" data-testid="daily-closed" data-outcome={outcome}>
      <GameHeader game={game} mode="daily" numberLabel={`#${daily.number}`} />
      <section className="mg-card text-center mt-2">
        {outcome === "solved" ? <CheckIcon className="w-8 h-8 mx-auto text-[var(--valid)]" /> : <RevealIcon className="w-8 h-8 mx-auto text-[var(--ink-soft)]" />}
        <div className="flex flex-col gap-1.5">
          <h2 className="mg-display text-[22px] font-semibold leading-tight">{t(`${outcome}Title`)}</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("body", { game: text.name(game.id) })}</p>
        </div>
        {outcome === "solved" && (
          <div className="py-3 rounded-2xl bg-[var(--linen)]">
            <div className="mg-display text-[44px] font-semibold leading-none tabular-nums" data-testid="daily-closed-time">
              {formatTime(result.elapsedMs)}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 text-sm font-semibold text-[var(--ink-soft)] whitespace-nowrap">
              <span>{ranking("hints", { count: result.hintsUsed })}</span>
              {result.points !== undefined && (
                <span className="flex items-center gap-1">
                  <TrophyIcon className="w-4 h-4 text-[var(--accent)]" /> {ranking("points", { points: result.points })}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <Link href={`${game.path}/practice`} prefetch={false} className="mg-button" data-variant="primary">
            <ShuffleIcon /> {t("practice")}
          </Link>
          <Link href={`/ranking?game=${game.id}`} prefetch={false} className="mg-button">
            <TrophyIcon /> {t("ranking")}
          </Link>
          <Link href="/" prefetch={false} className="mg-button justify-between">
            {t("otherGames")} <ArrowRightIcon />
          </Link>
        </div>
      </section>
      <GameFooter current={game.id} />
    </main>
  );
}
