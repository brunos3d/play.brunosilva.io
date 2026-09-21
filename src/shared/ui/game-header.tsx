"use client";

import Link from "next/link";
import type { GameMeta } from "@/games/registry";
import { formatTime } from "@/shared/engine/clock";
import type { Difficulty } from "@/shared/engine/difficulty";
import { GameIcon } from "./game-icons";
import { ClockIcon, GridIcon, HelpIcon, SettingsIcon } from "./icons";

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
};

const tab = (active: boolean): string => `px-3 py-1.5 rounded-full ${active ? "bg-[var(--ink)] text-[var(--linen)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`;

export function GameHeader({ game, mode, numberLabel, difficulty, size, elapsedMs, onHelp, onSettings }: HeaderProps) {
  return (
    <header className="mg-header w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <GameIcon game={game.id} className="w-9 h-9 flex-none rounded-[9px] shadow-[0_0_0_1.5px_var(--thread)]" />
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="mg-display text-[28px] font-semibold leading-none">{game.name}</h1>
            {numberLabel && <span className="text-sm font-semibold text-[var(--ink-soft)] tabular-nums">{numberLabel}</span>}
          </div>
        </div>
        <div className="flex items-center">
          {onHelp && (
            <button type="button" className="mg-icon-button" aria-label="How to play" onClick={onHelp}>
              <HelpIcon />
            </button>
          )}
          {onSettings && (
            <button type="button" className="mg-icon-button" aria-label="Settings" onClick={onSettings}>
              <SettingsIcon />
            </button>
          )}
          <Link href="/" prefetch={false} className="mg-icon-button" aria-label="All games">
            <GridIcon />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <nav className="flex items-center gap-1 text-sm font-semibold" aria-label="Game mode">
          <Link href={game.path} prefetch={false} aria-current={mode === "daily" ? "page" : undefined} className={tab(mode === "daily")}>
            Daily
          </Link>
          <Link href={`${game.path}/practice`} prefetch={false} aria-current={mode === "practice" ? "page" : undefined} className={tab(mode === "practice")}>
            Practice
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {difficulty && size && (
            <span className="mg-chip">
              {difficulty} {size}×{size}
            </span>
          )}
          {elapsedMs !== undefined && (
            <span className="flex items-center gap-1.5 font-semibold tabular-nums text-[15px]" role="timer" aria-label={`Time ${formatTime(elapsedMs)}`} data-testid="game-timer">
              <ClockIcon className="w-4 h-4 text-[var(--ink-soft)]" />
              {formatTime(elapsedMs)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
