"use client";

import { useTranslations } from "next-intl";
import { GAME_LIST, type GameId } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { useGameText } from "@/shared/hooks/use-game-text";
import { REPOSITORY_URL } from "@/shared/platform/site";

/** Way out of a game: the hub and the other games. */
export function GameFooter({ current }: { current?: GameId }) {
  const t = useTranslations("common.footer");
  const text = useGameText();
  return (
    <footer className="mg-footer w-full pt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--ink-faint)]">
      <Link href="/" prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
        {t("allGames")}
      </Link>
      {GAME_LIST.filter((game) => game.id !== current).map((game) => (
        <span key={game.id} className="contents">
          <span aria-hidden="true">·</span>
          <Link href={game.path} prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
            {t("play", { game: text.name(game.id) })}
          </Link>
        </span>
      ))}
      <span aria-hidden="true">·</span>
      <Link href={current ? `/ranking?game=${current}` : "/ranking"} prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
        {t("ranking")}
      </Link>
      <span aria-hidden="true">·</span>
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
        {t("github")}
      </a>
    </footer>
  );
}
