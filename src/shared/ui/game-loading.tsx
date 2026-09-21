import Link from "next/link";
import type { GameMeta } from "@/games/registry";
import type { DailyInfo } from "@/shared/engine/daily";
import { GameFooter } from "./game-footer";
import { GameHeader } from "./game-header";
import { LoadingBoard } from "./loading-board";

/** Shown while a puzzle is generated, or when its seed cannot be played. Same shell, so nothing jumps. */
export function GameLoading({ game, daily, error }: { game: GameMeta; daily?: DailyInfo; error?: string }) {
  return (
    <main className="mg-shell">
      <GameHeader game={game} mode={daily ? "daily" : "practice"} numberLabel={daily ? `#${daily.number}` : undefined} elapsedMs={0} />
      <div className="mg-stage">
        {error ? (
          <div className="rounded-2xl p-6 text-center bg-[var(--surface)]" role="alert">
            <p className="font-semibold mb-1">This seed cannot be played</p>
            <p className="text-sm text-[var(--ink-soft)] mb-4">{error}</p>
            <Link href={`${game.path}/practice`} prefetch={false} className="mg-button">
              Pick another puzzle
            </Link>
          </div>
        ) : (
          <LoadingBoard />
        )}
      </div>
      <GameFooter current={game.id} />
    </main>
  );
}

/** "A new daily puzzle is out" strip, shown when Pacific midnight passes with the page open. */
export function NewDailyBanner({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold bg-[var(--ink)] text-[var(--linen)]" role="status">
      A new daily puzzle is out.
      <button type="button" className="underline underline-offset-2" onClick={onPlay}>
        Play it
      </button>
    </div>
  );
}
