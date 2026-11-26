"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getChessDailyInfo } from "@/games/chess/engine/daily";
import { chessPuzzleId } from "@/games/chess/engine/generator";
import { getDailyInfo as getPatchesDaily } from "@/games/patches/engine/daily/schedule";
import { patchesPuzzleId } from "@/games/patches/engine/generator/generate";
import { getQueensDailyInfo } from "@/games/queens/engine/daily";
import { queensPuzzleId } from "@/games/queens/engine/generator";
import { GAME_LIST, type GameId, type GameMeta, PLATFORM_NAME } from "@/games/registry";
import { getSumbreakDailyInfo } from "@/games/sumbreak/engine/daily";
import { sumbreakPuzzleId } from "@/games/sumbreak/engine/generator";
import { getTermoDailyInfo } from "@/games/termo/engine/daily";
import { termoPuzzleId } from "@/games/termo/engine/seed";
import { getWendDailyInfo } from "@/games/wend/engine/daily";
import { wendPuzzleId } from "@/games/wend/engine/seed";
import { getZipDailyInfo } from "@/games/zip/engine/daily";
import { zipPuzzleId } from "@/games/zip/engine/generator";
import type { GameLanguage } from "@/i18n/game-language";
import { Link } from "@/i18n/navigation";
import { clockElapsed, formatTime, restoreClock } from "@/shared/engine/clock";
import type { DailyInfo } from "@/shared/engine/daily";
import { msUntilPacificMidnight } from "@/shared/engine/pacific-time";
import { computeStreak } from "@/shared/engine/streak";
import { useDailyDate } from "@/shared/hooks/use-daily-date";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGameText } from "@/shared/hooks/use-game-text";
import { useSettings } from "@/shared/hooks/use-settings";
import { HubOnline } from "@/shared/online/ranking-screen";
import { REPOSITORY_URL } from "@/shared/platform/site";
import { loadBoard, loadDailyResult, loadDailyResults, streakDates } from "@/shared/storage/progress";
import { GameIcon, PlatformIcon } from "../game-icons";
import { ArrowRightIcon, CheckIcon, ClockIcon, FlameIcon, RevealIcon, SettingsIcon } from "../icons";
import { LocaleSwitcher } from "../locale-switcher";
import { SettingsDialog } from "../settings-dialog";
import { ThemeToggle } from "../theme-toggle";

/** `info` takes the game language. Only the games made of words read it: they have one daily puzzle per language. */
const DAILY: Record<GameId, { info: (date: string, language: GameLanguage) => DailyInfo; puzzleId: (seed: string) => string }> = {
  zip: { info: (date) => getZipDailyInfo(date), puzzleId: zipPuzzleId },
  patches: { info: (date) => getPatchesDaily(date), puzzleId: patchesPuzzleId },
  chess: { info: (date) => getChessDailyInfo(date), puzzleId: chessPuzzleId },
  queens: { info: (date) => getQueensDailyInfo(date), puzzleId: queensPuzzleId },
  sumbreak: { info: (date) => getSumbreakDailyInfo(date), puzzleId: sumbreakPuzzleId },
  // These two keep their word lists out of the hub: the daily schedule and the puzzle id live in modules that do not import the generator.
  wend: { info: getWendDailyInfo, puzzleId: wendPuzzleId },
  termo: { info: getTermoDailyInfo, puzzleId: termoPuzzleId },
};

type Today =
  | { state: "new" }
  /** The clock started and keeps running, even with the game closed. */
  | { state: "running"; startedAt: number }
  | { state: "solved"; elapsedMs: number }
  | { state: "revealed" }
  /** Lost, as when Termo runs out of guesses. */
  | { state: "failed" };

type CardData = { today: Today; streak: number };

async function loadCard(game: GameId, daily: DailyInfo): Promise<CardData> {
  // Today's state is the puzzle's own, in its language. The streak counts every language of the game.
  const [result, results, board] = await Promise.all([loadDailyResult(game, daily.date, daily.variant), loadDailyResults(game), loadBoard(game, DAILY[game].puzzleId(daily.seed))]);
  const streak = computeStreak(streakDates(results), daily.date).current;
  if (result) return { streak, today: result.failed ? { state: "failed" } : result.revealed ? { state: "revealed" } : { state: "solved", elapsedMs: result.elapsedMs } };
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
  const t = useTranslations("hub");
  if (!today || today.state === "new") return <span className="text-[var(--ink-soft)]">{t("notPlayed")}</span>;
  if (today.state === "running") {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-[var(--accent)]">
        <ClockIcon className="w-4 h-4" /> {t("running")} · <span className="tabular-nums">{formatTime(clockElapsed({ startedAt: today.startedAt, finishedMs: null }, now))}</span>
      </span>
    );
  }
  if (today.state === "solved") {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-[var(--valid)]">
        <CheckIcon className="w-4 h-4" /> {t("solvedIn")} <span className="tabular-nums">{formatTime(today.elapsedMs)}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[var(--ink-soft)]">
      <RevealIcon className="w-4 h-4" /> {t(today.state === "failed" ? "notSolved" : "revealed")}
    </span>
  );
}

function GameCard({ game, daily, data, now }: { game: GameMeta; daily: DailyInfo | null; data: CardData | undefined; now: number }) {
  const t = useTranslations("hub");
  const text = useGameText();
  const done = data?.today.state === "solved" || data?.today.state === "revealed" || data?.today.state === "failed";
  return (
    <article className="mg-card" data-testid={`hub-card-${game.id}`}>
      <div className="flex items-start gap-4">
        <GameIcon game={game.id} className="w-[72px] h-[72px] flex-none rounded-[18px] shadow-[0_0_0_1.5px_var(--thread)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="mg-display text-[26px] font-semibold leading-none">{text.name(game.id)}</h2>
            {data && data.streak > 0 && (
              <span className="flex items-center gap-1 text-sm font-semibold" aria-label={t("streak", { count: data.streak })}>
                <FlameIcon className="w-4 h-4 text-[var(--accent)]" /> {data.streak}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--ink-soft)] mt-1.5">{text.tagline(game.id)}</p>
          <p className="text-sm leading-relaxed text-[var(--ink-soft)] mt-1">{text.description(game.id)}</p>
        </div>
      </div>

      {/* Number and tier on the left, today's state on the right. On a narrow phone the state moves to a line of its own instead of breaking. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm min-h-6 whitespace-nowrap" data-testid={`hub-today-${game.id}`}>
        <span className="font-semibold tabular-nums">{daily ? <>#{daily.number} · <span className="capitalize">{text.tier(game, daily.difficulty)}</span></> : " "}</span>
        {daily && <TodayLine today={data?.today} now={now} />}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Link href={game.path} prefetch={false} className="mg-button justify-between" data-variant={done ? undefined : "primary"}>
          {t(done ? "seeResult" : data?.today.state === "running" ? "continue" : "play")} <ArrowRightIcon />
        </Link>
        <Link href={`${game.path}/practice`} prefetch={false} className="mg-button">
          {t("practice")}
        </Link>
      </div>
    </article>
  );
}

/** Home screen: every game, what today looks like in each, and the time until the next boards. */
export function Hub() {
  const t = useTranslations("hub");
  const header = useTranslations("common.header");
  const footer = useTranslations("common.footer");
  const { playing: today } = useDailyDate();
  const { language } = useGameLanguage();
  const { settings, update } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        void loadCard(game.id, DAILY[game.id].info(today, language)).then((data) => {
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
    // The game language picks which daily of Termo and Wend the cards follow.
  }, [today, language]);

  return (
    <main className="mg-shell" style={{ gap: 18 }}>
      {/* The tagline has the whole width under the name: next to the buttons it broke into three lines on a phone. */}
      <header className="mg-header w-full flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <PlatformIcon className="mg-hub-mark flex-none rounded-[11px] shadow-[0_0_0_1.5px_var(--thread)]" />
            <h1 className="mg-display mg-hub-name font-semibold leading-none">{PLATFORM_NAME}</h1>
          </div>
          <div className="mg-header-actions flex items-center flex-none">
            <ThemeToggle />
            <LocaleSwitcher />
            <button type="button" className="mg-icon-button" aria-label={header("settings")} onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{t("tagline")}</p>
      </header>

      {GAME_LIST.map((game) => (
        <GameCard key={game.id} game={game} daily={today ? DAILY[game.id].info(today, language) : null} data={cards[game.id]} now={now ?? 0} />
      ))}

      <HubOnline />

      <p className="text-sm text-[var(--ink-soft)] text-center" data-testid="hub-countdown">
        {t.rich("countdown", { time: () => <span className="font-semibold tabular-nums text-[var(--ink)]">{now === null ? "--:--:--" : formatCountdown(msUntilPacificMidnight(new Date(now)))}</span> })}
      </p>

      <footer className="mg-footer w-full text-center text-xs text-[var(--ink-faint)]">
        {t("madeBy")}{" "}
        <a href="https://brunosilva.io" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          Bruno Silva
        </a>
        <span className="mx-2">·</span>
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          GitHub
        </a>
        <span className="mx-2">·</span>
        <Link href="/privacy" prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          {footer("privacy")}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          {footer("terms")}
        </Link>
      </footer>

      <SettingsDialog open={settingsOpen} settings={settings} onChange={update} onClose={() => setSettingsOpen(false)} showGameLanguage />
    </main>
  );
}
