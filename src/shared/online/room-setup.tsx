"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState, useSyncExternalStore } from "react";
import { SEED_CODECS } from "@/games/codecs";
import { GAMES, GAME_IDS, GAME_LIST, type GameId } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGameText } from "@/shared/hooks/use-game-text";
import { GameIcon } from "@/shared/ui/game-icons";
import { UsersIcon } from "@/shared/ui/icons";
import { PageHeader } from "@/shared/ui/page-header";
import { GameLanguagePicker } from "@/shared/ui/practice-setup";
import { OnlineError, online } from "./api";
import { MAX_ROUNDS, MIN_ROUNDS, type RoundDraft, roomPath } from "./rooms";
import { OnlineUnavailable } from "./unavailable";
import { usePlayer } from "./use-player";

type Row = { game: GameId; difficulty: Difficulty; size: number | null };

const DEFAULT_ROUNDS = 3;
const noSubscription = () => () => undefined;

/** The game the player came from, as `?game=zip`. The practice setup of each game links here with it. */
function useStartingGame(): GameId {
  const search = useSyncExternalStore(noSubscription, () => window.location.search, () => "");
  const game = new URLSearchParams(search).get("game");
  return game && (GAME_IDS as readonly string[]).includes(game) ? (game as GameId) : "zip";
}

/** Termo's tiers are modes, and "easy" and "medium" are the same one-word mode. Its picker offers each mode once. */
const MODES: readonly Difficulty[] = ["medium", "hard", "expert"];
const tiersOf = (game: GameId): readonly Difficulty[] => (GAMES[game].difficultyLabels ? MODES : DIFFICULTIES);

/**
 * Where a challenge is put together: how many rounds, and for each one the
 * game, the difficulty and the board size. The player who opens the room is
 * its host. Everyone who joins plays the same seeds.
 */
export function RoomSetup() {
  const t = useTranslations("online.setup");
  const race = useTranslations("online.race");
  const text = useGameText();
  const router = useRouter();
  const startingGame = useStartingGame();
  const { language } = useGameLanguage();
  const { unavailable, suggestion } = usePlayer();
  const [count, setCount] = useState(DEFAULT_ROUNDS);
  // Rows the host has touched. An untouched round follows the game the host came from.
  const [edits, setEdits] = useState<Record<number, Row>>({});
  const [state, setState] = useState<"idle" | "creating" | "failed" | "too-many">("idle");

  const rows: Row[] = Array.from({ length: count }, (_, index) => edits[index] ?? { game: startingGame, difficulty: "medium", size: null });
  const setRow = (index: number, patch: Partial<Row>) =>
    setEdits((current) => {
      const next = { ...rows[index], ...patch };
      // A size belongs to a game. Changing the game goes back to the automatic one.
      if (patch.game && patch.game !== rows[index].game) {
        next.size = null;
        if (!tiersOf(patch.game).includes(next.difficulty)) next.difficulty = "medium";
      }
      return { ...current, [index]: next };
    });
  const hasWords = rows.some((row) => GAMES[row.game].language === "words");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setState("creating");
    const rounds: RoundDraft[] = rows.map((row) => ({ game: row.game, difficulty: row.difficulty, ...(row.size !== null ? { size: row.size } : {}), ...(GAMES[row.game].language === "words" ? { lang: language } : {}) }));
    try {
      const room = await online.createRoom(rounds, suggestion());
      router.push(roomPath(room.code));
    } catch (error) {
      setState(error instanceof OnlineError && error.code === "too-many-rooms" ? "too-many" : "failed");
    }
  };

  if (unavailable) return <OnlineUnavailable title={t("title")} />;

  return (
    <main className="mg-shell">
      <PageHeader title={t("title")} />

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 mt-1" data-testid="room-setup">
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">{t("blurb")}</p>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between">
            <span className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{t("rounds")}</span>
            <span className="font-semibold tabular-nums" data-testid="room-round-count">
              {t("count", { count })}
            </span>
          </span>
          <input type="range" className="mg-range" min={MIN_ROUNDS} max={MAX_ROUNDS} step={1} value={count} onChange={(event) => setCount(Number(event.target.value))} aria-valuetext={t("count", { count })} data-testid="room-rounds" />
        </label>

        <ol className="flex flex-col gap-2.5">
          {rows.map((row, index) => {
            const game = GAMES[row.game];
            const codec = SEED_CODECS[row.game];
            const sizes = Array.from({ length: codec.maxSize - codec.minSize + 1 }, (_, offset) => codec.minSize + offset);
            return (
              <li key={index} className="mg-card" style={{ gap: 10, padding: 14 }} data-testid={`room-round-${index + 1}`}>
                <div className="flex items-center gap-2.5">
                  <GameIcon game={row.game} className="w-8 h-8 flex-none rounded-[8px] shadow-[0_0_0_1.5px_var(--thread)]" />
                  <span className="font-semibold">{t("round", { number: index + 1 })}</span>
                </div>
                <div className={`grid gap-2 ${game.hasSizes ? "grid-cols-[1.3fr_1fr_0.8fr]" : "grid-cols-[1.3fr_1fr]"}`}>
                  <select className="mg-select" value={row.game} onChange={(event) => setRow(index, { game: event.target.value as GameId })} aria-label={t("game")} data-testid="room-game">
                    {GAME_LIST.map((option) => (
                      <option key={option.id} value={option.id}>
                        {text.name(option.id)}
                      </option>
                    ))}
                  </select>
                  <select className="mg-select capitalize" value={row.difficulty} onChange={(event) => setRow(index, { difficulty: event.target.value as Difficulty })} aria-label={t(game.difficultyLabels ? "mode" : "difficulty")} data-testid="room-difficulty">
                    {tiersOf(row.game).map((tier) => (
                      <option key={tier} value={tier}>
                        {text.tier(game, tier)}
                      </option>
                    ))}
                  </select>
                  {game.hasSizes && (
                    <select className="mg-select" value={row.size ?? ""} onChange={(event) => setRow(index, { size: event.target.value === "" ? null : Number(event.target.value) })} aria-label={t("size")} data-testid="room-size">
                      <option value="">{t("auto")}</option>
                      {sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}×{size}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {count > 1 && (
          <button type="button" className="mg-button" onClick={() => setEdits(Object.fromEntries(rows.map((_, index) => [index, { ...rows[0] }])))} data-testid="room-same">
            {t("sameForAll")}
          </button>
        )}

        {hasWords && <GameLanguagePicker />}

        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{race("rules")}</p>

        {(state === "failed" || state === "too-many") && (
          <p className="text-sm font-semibold text-[var(--invalid)]" role="alert">
            {t(state === "too-many" ? "tooMany" : "failed")}
          </p>
        )}

        <button type="submit" className="mg-button" data-variant="primary" disabled={state === "creating"} data-testid="room-create">
          <UsersIcon /> {t(state === "creating" ? "creating" : "create")}
        </button>
      </form>
    </main>
  );
}
