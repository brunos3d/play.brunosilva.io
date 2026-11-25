"use client";

import { useTranslations } from "next-intl";
import type { GameMeta } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import type { DailyInfo } from "@/shared/engine/daily";
import { GameFooter } from "./game-footer";
import { GameHeader } from "./game-header";
import { LoadingBoard } from "./loading-board";

/**
 * Shown while a puzzle is generated, or when its seed cannot be played. Same
 * shell, so nothing jumps. `error` is the generator's own message. It is
 * technical and in English, so it sits under a sentence in the page's language.
 */
export function GameLoading({ game, daily, error }: { game: GameMeta; daily?: DailyInfo; error?: string }) {
  const t = useTranslations("common.loading");
  return (
    <main className="mg-shell">
      <GameHeader game={game} mode={daily ? "daily" : "practice"} numberLabel={daily ? `#${daily.number}` : undefined} elapsedMs={0} />
      <div className="mg-stage">
        {error ? (
          <div className="rounded-2xl p-6 text-center bg-[var(--surface)]" role="alert">
            <p className="font-semibold mb-1">{t("badSeed")}</p>
            <p className="text-sm text-[var(--ink-soft)]">{t("badSeedBody")}</p>
            <p className="text-xs text-[var(--ink-faint)] mt-1 mb-4" lang="en">
              {error}
            </p>
            <Link href={`${game.path}/practice`} prefetch={false} className="mg-button">
              {t("pickAnother")}
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
  const t = useTranslations("common.loading");
  return (
    <div className="sticky top-0 z-10 flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold bg-[var(--ink)] text-[var(--linen)]" role="status">
      {t("newDaily")}
      <button type="button" className="underline underline-offset-2" onClick={onPlay}>
        {t("playIt")}
      </button>
    </div>
  );
}
