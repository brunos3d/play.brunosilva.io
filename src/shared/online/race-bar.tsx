"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/shared/engine/clock";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { FlagIcon } from "@/shared/ui/icons";
import { PlayerAvatar } from "./player-avatar";
import { rankRoom, standingOf } from "./rooms";
import type { Race } from "./use-race";
import { useTicker } from "./use-room";

/** How long the news of someone finishing stays on screen. Long enough to read and decide, short enough to leave the board alone. */
const TOAST_MS = 9_000;
/** Other players shown in the strip. The rest are one tap away, in the room's table. */
const SHOWN_PLAYERS = 5;

/**
 * The strip a round of a race puts above the game's header: the round, the
 * player's race clock, the other players with how far each one is, and the way
 * out. When someone finishes the whole race, it says so once at the top of the
 * screen and offers to give up, without covering the board.
 */
export function RaceBar({ race, onOpenChange }: { race: Race; onOpenChange?: (open: boolean) => void }) {
  const t = useTranslations("online.race");
  const [confirming, setConfirming] = useState(false);
  const [news, setNews] = useState<{ id: string; name: string; time: string } | null>(null);
  const announced = useRef<Set<string> | null>(null);
  useTicker(1_000);

  const { room, you } = race;
  const total = room?.rounds.length ?? 0;
  const now = race.serverNow();
  const mine = you ? standingOf(you, total, now) : null;

  // Someone else played their last round: say it once. Players who had finished before this page opened are not news.
  useEffect(() => {
    if (!room) return;
    const finished = rankRoom(room.players, room.rounds.length, room.now).filter((standing) => standing.state === "finished" && standing.player.id !== room.you);
    if (announced.current === null) {
      announced.current = new Set(finished.map((standing) => standing.player.id));
      return;
    }
    const fresh = finished.find((standing) => !announced.current?.has(standing.player.id));
    if (!fresh) return;
    announced.current.add(fresh.player.id);
    setNews({ id: fresh.player.id, name: fresh.player.name, time: formatTime(fresh.timeMs ?? 0) });
  }, [room]);

  useEffect(() => {
    if (!news) return;
    const timeout = window.setTimeout(() => setNews(null), TOAST_MS);
    return () => window.clearTimeout(timeout);
  }, [news]);

  useEffect(() => {
    onOpenChange?.(confirming);
  }, [confirming, onOpenChange]);

  const others = room ? room.players.filter((player) => player.id !== room.you).map((player) => standingOf(player, total, now)) : [];

  return (
    <>
      <div className="mg-race" role="group" aria-label={t("label", { code: race.code })} data-testid="race-bar">
        <FlagIcon />
        <span data-testid="race-round">{total > 0 ? t("round", { round: Math.min(race.round + 1, total), total }) : race.code}</span>
        {mine?.timeMs !== null && mine?.timeMs !== undefined && (
          <span className="tabular-nums text-[var(--ink-soft)]" role="timer" aria-label={t("clock", { time: formatTime(mine.timeMs) })} data-testid="race-clock">
            {formatTime(mine.timeMs)}
          </span>
        )}
        <span className="mg-race-players">
          {others.slice(0, SHOWN_PLAYERS).map((standing) => (
            <span
              key={standing.player.id}
              className="mg-race-player"
              data-state={standing.state}
              data-testid="race-player"
              role="img"
              aria-label={standing.state === "finished" ? t("done", { name: standing.player.name }) : standing.state === "gave-up" ? t("out", { name: standing.player.name }) : t("progress", { name: standing.player.name, round: Math.min(standing.played + 1, total), total })}
              title={standing.player.name}
            >
              <PlayerAvatar seed={standing.player.avatar} size={26} />
              <span className="mg-race-badge" aria-hidden="true">
                {standing.state === "finished" ? "✓" : standing.state === "gave-up" ? "×" : Math.min(standing.played + 1, total)}
              </span>
            </span>
          ))}
          {others.length > SHOWN_PLAYERS && <span className="ml-1.5 text-[var(--ink-soft)]">+{others.length - SHOWN_PLAYERS}</span>}
        </span>
        <button type="button" className="mg-race-quit" onClick={() => setConfirming(true)} data-testid="race-give-up">
          {t("giveUp")}
        </button>
      </div>

      {news && (
        <div className="mg-toast" role="status" data-testid="race-toast">
          <span>{t("finished", { name: news.name, time: news.time })}</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setNews(null)}>
              {t("keepGoing")}
            </button>
            <button
              type="button"
              onClick={() => {
                setNews(null);
                setConfirming(true);
              }}
            >
              {t("giveUp")}
            </button>
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t("giveUpTitle")}
        confirmLabel={t("giveUp")}
        cancelLabel={t("keepGoing")}
        testId="race-confirm"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void race.giveUp();
        }}
      >
        {t("giveUpBody")}
      </ConfirmDialog>
    </>
  );
}
