import Link from "next/link";
import { GAME_LIST, type GameId } from "@/games/registry";
import { REPOSITORY_URL } from "@/shared/platform/site";

/** Way out of a game: the hub and the other games. */
export function GameFooter({ current }: { current?: GameId }) {
  return (
    <footer className="mg-footer w-full pt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--ink-faint)]">
      <Link href="/" prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
        All games
      </Link>
      {GAME_LIST.filter((game) => game.id !== current).map((game) => (
        <span key={game.id} className="contents">
          <span aria-hidden="true">·</span>
          <Link href={game.path} prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
            Play {game.name}
          </Link>
        </span>
      ))}
      <span aria-hidden="true">·</span>
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
        GitHub
      </a>
    </footer>
  );
}
