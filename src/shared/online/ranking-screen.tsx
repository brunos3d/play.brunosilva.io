"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { GAMES, GAME_IDS, GAME_LIST, type GameId, dailyVariant } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/shared/engine/clock";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGameText } from "@/shared/hooks/use-game-text";
import { GameIcon } from "@/shared/ui/game-icons";
import { ArrowRightIcon, FlameIcon, TrophyIcon, UsersIcon } from "@/shared/ui/icons";
import { PageHeader } from "@/shared/ui/page-header";
import { OnlineError, online } from "./api";
import { PlayerAvatar } from "./player-avatar";
import { ProfileEditor } from "./profile-editor";
import type { Ranking, RankingEntry, RankingPeriod } from "./types";
import { OnlineUnavailable } from "./unavailable";
import { usePlayer } from "./use-player";

const noSubscription = () => () => undefined;

type Loaded = { key: string; ranking: Ranking | null; error: string | null };

/** Loads a ranking, and again whenever what is asked for changes. `ranking` is null while the answer is on its way. */
export function useRanking(period: RankingPeriod, game: GameId | "all", variant = ""): { ranking: Ranking | null; error: string | null } {
  const key = `${period}|${game}|${variant}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    online
      .ranking(period, game, variant)
      .then((ranking) => {
        if (!cancelled) setLoaded({ key, ranking, error: null });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoaded({ key, ranking: null, error: failure instanceof OnlineError ? failure.code : "offline" });
      });
    return () => {
      cancelled = true;
    };
  }, [game, key, period, variant]);
  return loaded?.key === key ? { ranking: loaded.ranking, error: loaded.error } : { ranking: null, error: null };
}

export function RankingRow({ entry, you, byTime }: { entry: RankingEntry; you: boolean; byTime: boolean }) {
  const t = useTranslations("online.ranking");
  return (
    <li className="mg-row" data-you={you || undefined} data-testid="ranking-row">
      <span className="mg-rank">{entry.rank}</span>
      <PlayerAvatar seed={entry.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold truncate" data-testid="ranking-name">
            {entry.name}
          </span>
          {you && <span className="mg-tag">{t("you")}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
          {byTime ? <span>{t("hints", { count: entry.hints ?? 0 })}</span> : <span>{t("solved", { count: entry.solved })}</span>}
          {entry.streak > 1 && (
            <span className="flex items-center gap-0.5" aria-label={t("streak", { count: entry.streak })}>
              <FlameIcon className="w-3.5 h-3.5 text-[var(--accent)]" /> {entry.streak}
            </span>
          )}
        </div>
      </div>
      <div className="font-semibold tabular-nums flex-none" data-testid="ranking-score">
        {byTime ? formatTime(entry.elapsedMs ?? 0) : t("points", { points: entry.points })}
      </div>
    </li>
  );
}

/** The game asked for in the address, as `?game=zip`. Game pages and result screens link here with it. */
function useRequestedGame(): GameId | "all" {
  const search = useSyncExternalStore(noSubscription, () => window.location.search, () => "");
  const game = new URLSearchParams(search).get("game");
  return game && (GAME_IDS as readonly string[]).includes(game) ? (game as GameId) : "all";
}

/**
 * The rankings: today or this week, for every game together or for one. One
 * game on one day is ranked by time, since everyone had the same puzzle.
 * Everything else is ranked by points.
 */
export function RankingScreen() {
  const t = useTranslations("online.ranking");
  const text = useGameText();
  const requested = useRequestedGame();
  const [picked, setPicked] = useState<GameId | "all" | null>(null);
  const [period, setPeriod] = useState<RankingPeriod>("today");
  const { language } = useGameLanguage();
  const { me, unavailable } = usePlayer();
  const game = picked ?? requested;
  // A game with one daily per language has one puzzle per language, so its ranking by time is the one of the player's game language.
  const variant = game === "all" ? "" : (dailyVariant(GAMES[game], language) ?? "");
  const { ranking, error } = useRanking(period, game, variant);
  const byTime = period === "today" && game !== "all";

  if (unavailable || error === "unavailable") return <OnlineUnavailable title={t("title")} />;

  return (
    <main className="mg-shell" data-testid="ranking">
      <PageHeader title={t("title")} />

      <div className="mg-segment w-full" role="group" aria-label={t("period")}>
        {(["today", "week"] as const).map((option) => (
          <button key={option} type="button" aria-pressed={period === option} onClick={() => setPeriod(option)} data-testid={`ranking-${option}`}>
            {t(option)}
          </button>
        ))}
      </div>

      <div className="w-full flex flex-wrap gap-1.5" role="group" aria-label={t("game")}>
        <button type="button" className="mg-chip cursor-pointer" style={{ height: 32 }} aria-pressed={game === "all"} data-active={game === "all" || undefined} onClick={() => setPicked("all")} data-testid="ranking-game-all">
          {t("allGames")}
        </button>
        {GAME_LIST.map((option) => (
          <button key={option.id} type="button" className="mg-chip cursor-pointer gap-1.5" style={{ height: 32, paddingLeft: 5 }} aria-pressed={game === option.id} data-active={game === option.id || undefined} onClick={() => setPicked(option.id)} data-testid={`ranking-game-${option.id}`}>
            <GameIcon game={option.id} className="w-[22px] h-[22px] rounded-[6px]" /> {text.name(option.id)}
          </button>
        ))}
      </div>

      <p className="w-full text-sm text-[var(--ink-soft)] leading-relaxed">{t(byTime ? "rulesTime" : "rulesPoints")}</p>

      {ranking === null ? (
        <p className="mg-status" role="status">
          {error ? null : t("loading")}
        </p>
      ) : ranking.entries.length === 0 ? (
        <div className="mg-card text-center" data-testid="ranking-empty">
          <TrophyIcon className="w-8 h-8 mx-auto text-[var(--ink-faint)]" />
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("empty")}</p>
        </div>
      ) : (
        <>
          <p className="w-full flex items-center justify-between text-xs text-[var(--ink-faint)]">
            <span>{ranking.from === ranking.to ? ranking.to : t("range", { from: ranking.from, to: ranking.to })}</span>
            <span>{t("players", { count: ranking.players })}</span>
          </p>
          <ol className="w-full flex flex-col gap-2" data-testid="ranking-list">
            {ranking.entries.map((entry) => (
              <RankingRow key={entry.id} entry={entry} you={entry.id === me?.id} byTime={byTime} />
            ))}
            {ranking.you && <RankingRow entry={ranking.you} you byTime={byTime} />}
          </ol>
        </>
      )}

      {game !== "all" && (
        <Link href={GAMES[game].path} prefetch={false} className="mg-button w-full justify-between" data-variant="primary">
          {text.name(game)} <ArrowRightIcon />
        </Link>
      )}

      <section className="mg-card w-full" data-testid="ranking-profile">
        <ProfileEditor />
      </section>

      <Link href="/rooms/new" prefetch={false} className="mg-button w-full">
        <UsersIcon /> {t("challenge")}
      </Link>
    </main>
  );
}

/** The ranking on the home screen: the top of the week, and the two ways into the online side of the site. Hidden on a deployment without a database. */
export function HubOnline() {
  const t = useTranslations("online.ranking");
  const { me, unavailable } = usePlayer();
  const { ranking, error } = useRanking("week", "all");
  if (unavailable || error === "unavailable") return null;
  const top = ranking?.entries.slice(0, 3) ?? [];
  // The player's own row goes under the top three when they are not in it, so the home screen always answers "where am I?".
  const mine = ranking?.entries.find((entry) => entry.id === me?.id) ?? ranking?.you ?? null;
  const own = mine && !top.some((entry) => entry.id === mine.id) ? mine : null;

  return (
    <section className="mg-card" data-testid="hub-online">
      <div className="flex items-center justify-between gap-2">
        <h2 className="mg-display text-[22px] font-semibold leading-none flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-[var(--accent)]" /> {t("hubTitle")}
        </h2>
      </div>
      {ranking && top.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("hubEmpty")}</p>
      ) : (
        <ol className="flex flex-col gap-2 min-h-[56px]">
          {top.map((entry) => (
            <RankingRow key={entry.id} entry={entry} you={entry.id === me?.id} byTime={false} />
          ))}
          {own && <RankingRow entry={own} you byTime={false} />}
        </ol>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/ranking" prefetch={false} className="mg-button" data-testid="hub-ranking">
          {t("see")}
        </Link>
        <Link href="/rooms/new" prefetch={false} className="mg-button" data-variant="primary" data-testid="hub-challenge">
          <UsersIcon /> {t("challengeTitle")}
        </Link>
      </div>
    </section>
  );
}
