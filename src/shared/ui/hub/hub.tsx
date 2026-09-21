"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDailyInfo as getPatchesDaily } from "@/games/patches/engine/daily/schedule";
import { patchesPuzzleId } from "@/games/patches/engine/generator/generate";
import { GAME_LIST, type GameId, type GameMeta, PLATFORM_NAME } from "@/games/registry";
import { getZipDailyInfo } from "@/games/zip/engine/daily";
import { zipPuzzleId } from "@/games/zip/engine/generator";
import { clockElapsed, formatTime, restoreClock } from "@/shared/engine/clock";
import type { DailyInfo } from "@/shared/engine/daily";
import { msUntilPacificMidnight } from "@/shared/engine/pacific-time";
import { computeStreak } from "@/shared/engine/streak";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { REPOSITORY_URL } from "@/shared/platform/site";
import { loadBoard, loadDailyResult, loadDailyResults, streakDates } from "@/shared/storage/progress";
import { GameIcon, PlatformIcon } from "../game-icons";
import { ArrowRightIcon, CheckIcon, ClockIcon, FlameIcon, RevealIcon } from "../icons";

const DAILY: Record<GameId, { info: (date: string) => DailyInfo; puzzleId: (seed: string) => string }> = {
  zip: { info: getZipDailyInfo, puzzleId: zipPuzzleId },
  patches: { info: getPatchesDaily, puzzleId: patchesPuzzleId },
};

type Today =
  | { state: "new" }
  /** The clock started and keeps running, even with the game closed. */
  | { state: "running"; startedAt: number }
  | { state: "solved"; elapsedMs: number }
  | { state: "revealed" };

type CardData = { today: Today; streak: number };

async function loadCard(game: GameId, daily: DailyInfo): Promise<CardData> {
  const [result, results, board] = await Promise.all([loadDailyResult(game, daily.date), loadDailyResults(game), loadBoard(game, DAILY[game].puzzleId(daily.seed))]);
  const streak = computeStreak(streakDates(results), daily.date).current;
  if (result) return { streak, today: result.revealed ? { state: "revealed" } : { state: "solved", elapsedMs: result.elapsedMs } };
  const saved = (board ?? {}) as { startedAt?: unknown; finishedMs?: unknown };
  const clock = restoreClock(saved.startedAt, saved.finishedMs);
  return { streak, today: clock.startedAt !== null && clock.finishedMs === null ? { state: "running", startedAt: clock.startedAt } : { state: "new" } };
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function TodayLine({ today, now }: { today: Today | undefined; now: number }) {
  if (!today || today.state === "new") return <span className="text-[var(--ink-soft)]">Not played yet</span>;
  if (today.state === "running") {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-[var(--accent)]">
        <ClockIcon className="w-4 h-4" /> Clock running · <span className="tabular-nums">{formatTime(clockElapsed({ startedAt: today.startedAt, finishedMs: null }, now))}</span>
      </span>
    );
  }
  if (today.state === "solved") {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-[var(--valid)]">
        <CheckIcon className="w-4 h-4" /> Solved in <span className="tabular-nums">{formatTime(today.elapsedMs)}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[var(--ink-soft)]">
      <RevealIcon className="w-4 h-4" /> Solution revealed
    </span>
  );
}

function GameCard({ game, daily, data, now }: { game: GameMeta; daily: DailyInfo | null; data: CardData | undefined; now: number }) {
  const done = data?.today.state === "solved" || data?.today.state === "revealed";
  return (
    <article className="mg-card" data-testid={`hub-card-${game.id}`}>
      <div className="flex items-start gap-4">
        <GameIcon game={game.id} className="w-[72px] h-[72px] flex-none rounded-[18px] shadow-[0_0_0_1.5px_var(--thread)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="mg-display text-[26px] font-semibold leading-none">{game.name}</h2>
            {data && data.streak > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold" aria-label={`${data.streak} day streak`}>
                <FlameIcon className="w-4 h-4 text-[var(--accent)]" /> {data.streak}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--ink-soft)] mt-1.5">{game.tagline}</p>
          <p className="text-sm leading-relaxed text-[var(--ink-soft)] mt-1">{game.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm min-h-6" data-testid={`hub-today-${game.id}`}>
        <span className="font-semibold tabular-nums">{daily ? <>#{daily.number} · <span className="capitalize">{daily.difficulty}</span></> : " "}</span>
        {daily && <TodayLine today={data?.today} now={now} />}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Link href={game.path} prefetch={false} className="mg-button justify-between" data-variant={done ? undefined : "primary"}>
          {done ? "See today's result" : data?.today.state === "running" ? "Continue playing" : "Play today's puzzle"} <ArrowRightIcon />
        </Link>
        <Link href={`${game.path}/practice`} prefetch={false} className="mg-button">
          Practice
        </Link>
      </div>
    </article>
  );
}

/** Home screen: every game, what today looks like in each, and the time until the next boards. */
export function Hub() {
  const { playing: today } = useDailyDate();
  const [cards, setCards] = useState<Partial<Record<GameId, CardData>>>({});
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    const refresh = () => {
      for (const game of GAME_LIST) {
        void loadCard(game.id, DAILY[game.id].info(today)).then((data) => {
          if (!cancelled) setCards((current) => ({ ...current, [game.id]: data }));
        });
      }
    };
    refresh();
    // Coming back from a game through the browser's back button restores this page without remounting it.
    window.addEventListener("pageshow", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", refresh);
    };
  }, [today]);

  return (
    <main className="mg-shell" style={{ gap: 18 }}>
      <header className="w-full flex items-center gap-3 pt-2">
        <PlatformIcon className="w-11 h-11 flex-none rounded-[11px] shadow-[0_0_0_1.5px_var(--thread)]" />
        <div>
          <h1 className="mg-display text-[30px] font-semibold leading-none">{PLATFORM_NAME}</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">One new board per game, every day.</p>
        </div>
      </header>

      {GAME_LIST.map((game) => (
        <GameCard key={game.id} game={game} daily={today ? DAILY[game.id].info(today) : null} data={cards[game.id]} now={now ?? 0} />
      ))}

      <p className="text-sm text-[var(--ink-soft)] text-center" data-testid="hub-countdown">
        New boards in <span className="font-semibold tabular-nums text-[var(--ink)]">{now === null ? "--:--:--" : formatCountdown(msUntilPacificMidnight(new Date(now)))}</span>, at midnight Pacific Time.
      </p>

      <footer className="mg-footer w-full text-center text-xs text-[var(--ink-faint)]">
        Made by{" "}
        <a href="https://brunosilva.io" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          Bruno Silva
        </a>
        <span className="mx-2">·</span>
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          GitHub
        </a>
      </footer>
    </main>
  );
}
