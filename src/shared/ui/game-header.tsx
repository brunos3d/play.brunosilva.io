"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import type { GameMeta } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/shared/engine/clock";
import type { Difficulty } from "@/shared/engine/difficulty";
import { useGameText } from "@/shared/hooks/use-game-text";
import { GameIcon } from "./game-icons";
import { ClockIcon, HelpIcon, SettingsIcon } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

type HeaderProps = {
  game: GameMeta;
  mode: "daily" | "practice";
  /** "#188" for daily, empty for practice. */
  numberLabel?: string;
  difficulty?: Difficulty;
  size?: number;
  /** Omit on pages without a running puzzle, such as practice setup. */
  elapsedMs?: number;
  onHelp?: () => void;
  onSettings?: () => void;
  /** Runs before the link to the hub is followed. Call `preventDefault` to keep the player on the page. */
  onHome?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const tab = (active: boolean): string => `px-3 py-1.5 rounded-full ${active ? "bg-[var(--ink)] text-[var(--linen)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`;

export function GameHeader({ game, mode, numberLabel, difficulty, size, elapsedMs, onHelp, onSettings, onHome }: HeaderProps) {
  const t = useTranslations("common.header");
  const text = useGameText();
  const name = text.name(game.id);
  return (
    <header className="mg-header w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          {/* The game's mark is the way home: it is where players look for it first. */}
          <Link href="/" prefetch={false} className="mg-home-link" aria-label={t("home", { game: name })} onClick={onHome} data-testid="game-home">
            <GameIcon game={game.id} className="mg-home-mark flex-none rounded-[9px] shadow-[0_0_0_1.5px_var(--thread)]" />
            <h1 className="mg-display mg-home-name font-semibold leading-none">{name}</h1>
          </Link>
          {/* Nudged down to sit on the title's baseline: the link beside it is centred on the icon, not on the text. */}
          {numberLabel && <span className="text-sm font-semibold text-[var(--ink-soft)] tabular-nums translate-y-[4px]">{numberLabel}</span>}
        </div>
        {/* Help, theme, interface language, settings. The way back to the hub is the game's mark on the left. */}
        <div className="mg-header-actions flex items-center">
          {onHelp && (
            <button type="button" className="mg-icon-button" aria-label={t("help")} onClick={onHelp}>
              <HelpIcon />
            </button>
          )}
          <ThemeToggle />
          <LocaleSwitcher />
          {onSettings && (
            <button type="button" className="mg-icon-button" aria-label={t("settings")} onClick={onSettings}>
              <SettingsIcon />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <nav className="flex items-center gap-1 text-sm font-semibold" aria-label={t("mode")}>
          <Link href={game.path} prefetch={false} aria-current={mode === "daily" ? "page" : undefined} className={tab(mode === "daily")}>
            {t("daily")}
          </Link>
          <Link href={`${game.path}/practice`} prefetch={false} aria-current={mode === "practice" ? "page" : undefined} className={tab(mode === "practice")}>
            {t("practice")}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {difficulty && size && (
            <span className="mg-chip">
              {text.tier(game, difficulty)}
              {game.hasSizes && ` ${size}×${size}`}
            </span>
          )}
          {elapsedMs !== undefined && (
            <span className="flex items-center gap-1.5 font-semibold tabular-nums text-[15px]" role="timer" aria-label={t("time", { time: formatTime(elapsedMs) })} data-testid="game-timer">
              <ClockIcon className="w-4 h-4 text-[var(--ink-soft)]" />
              {formatTime(elapsedMs)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
