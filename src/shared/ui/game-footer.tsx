"use client";

import { useTranslations } from "next-intl";
import { GAME_LIST, type GameId } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { useGameText } from "@/shared/hooks/use-game-text";
import { REPOSITORY_URL } from "@/shared/platform/site";

/**
 * Way out of a game: the hub and the other games. The links are set apart by
 * space alone. Dots between them ended up alone at the start or the end of a
 * line whenever the row wrapped, which on a phone is always.
 */
export function GameFooter({ current }: { current?: GameId }) {
  const t = useTranslations("common.footer");
  const text = useGameText();
  return (
    <footer className="mg-footer w-full pt-2 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-3 text-xs text-[var(--ink-faint)]">
      <Link href="/" prefetch={false} className="mg-text-link">
        {t("allGames")}
      </Link>
      {GAME_LIST.filter((game) => game.id !== current).map((game) => (
        <Link key={game.id} href={game.path} prefetch={false} className="mg-text-link">
          {t("play", { game: text.name(game.id) })}
        </Link>
      ))}
      <Link href={current ? `/ranking?game=${current}` : "/ranking"} prefetch={false} className="mg-text-link">
        {t("ranking")}
      </Link>
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="mg-text-link">
        {t("github")}
      </a>
    </footer>
  );
}
