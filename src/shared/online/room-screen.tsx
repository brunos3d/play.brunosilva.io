"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { GAMES } from "@/games/registry";
import { LOCALE_META, isLocale } from "@/i18n/config";
import { Link, useRouter } from "@/i18n/navigation";
import { formatTime } from "@/shared/engine/clock";
import { useGameText } from "@/shared/hooks/use-game-text";
import { share } from "@/shared/platform/sharing";
import { LocaleFlag } from "@/shared/ui/flags";
import { GameIcon } from "@/shared/ui/game-icons";
import { ArrowRightIcon, CheckIcon, CloseIcon, CopyIcon, FlagIcon, ShareIcon, TrophyIcon, UsersIcon } from "@/shared/ui/icons";
import { PageHeader } from "@/shared/ui/page-header";
import { OnlineError, online } from "./api";
import { PlayerAvatar } from "./player-avatar";
import { ProfileFields, useProfileDraft } from "./profile-editor";
import { type Standing, nextRound, rankRoom, roomPath, roundPath } from "./rooms";
import type { RoomState, RoundConfig } from "./types";
import { OnlineUnavailable } from "./unavailable";
import { rememberPlayer } from "./use-player";
import { useRoom, useTicker } from "./use-room";

const COPIED_MS = 2_500;

/** The address that brings someone into the room. It has no locale: the proxy sends each visitor to their own language. */
const inviteUrl = (code: string): string => `${window.location.origin}${roomPath(code)}`;

function RoundList({ rounds }: { rounds: readonly RoundConfig[] }) {
  const t = useTranslations("online.room");
  const text = useGameText();
  return (
    <section className="w-full flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{t("rounds")}</h2>
      <ol className="flex flex-col gap-1.5" data-testid="room-round-list">
        {rounds.map((round, index) => {
          const game = GAMES[round.game];
          return (
            <li key={index} className="flex items-center gap-2.5 text-sm">
              <GameIcon game={round.game} className="w-6 h-6 flex-none rounded-[6px] shadow-[0_0_0_1.5px_var(--thread)]" />
              <span className="font-semibold">{t("roundLine", { number: index + 1, game: text.name(round.game) })}</span>
              <span className="mg-chip">
                {text.tier(game, round.difficulty)}
                {game.hasSizes && round.size ? ` ${round.size}×${round.size}` : ""}
              </span>
              {round.lang && isLocale(round.lang) && <LocaleFlag locale={round.lang} className="mg-flag" />}
              {round.lang && isLocale(round.lang) && <span className="sr-only">{LOCALE_META[round.lang].nativeLabel}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** One line of the table: place, player, how far they are and their time. */
function StandingRow({ standing, place, total, you, host }: { standing: Standing; place: number; total: number; you: boolean; host: boolean }) {
  const t = useTranslations("online.room");
  const { player, state } = standing;
  return (
    <li className="mg-row" data-you={you || undefined} data-state={state} data-testid="room-standing">
      <span className="mg-rank">{place}</span>
      <PlayerAvatar seed={player.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold truncate" data-testid="room-player-name">
            {player.name}
          </span>
          {you && <span className="mg-tag">{t("you")}</span>}
          {host && <span className="mg-tag">{t("host")}</span>}
          {standing.away && state !== "finished" && state !== "gave-up" && <span className="mg-tag">{t("away")}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
          {/* One mark per round played: solved or not. */}
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {player.results.map((result, index) => (result.solved ? <CheckIcon key={index} className="w-3.5 h-3.5 text-[var(--valid)]" /> : <CloseIcon key={index} className="w-3.5 h-3.5 text-[var(--invalid)]" />))}
          </span>
          <span>{state === "gave-up" ? t("stateGaveUp") : state === "waiting" ? t("stateWaiting") : state === "racing" ? t("stateRacing", { round: Math.min(standing.played + 1, total), total }) : t("solved", { solved: standing.solved, total })}</span>
        </div>
      </div>
      <div className="text-right flex-none">
        <div className="font-semibold tabular-nums" data-testid="room-time">
          {standing.timeMs === null ? "--:--" : formatTime(standing.timeMs)}
        </div>
        {standing.penaltyMs > 0 && <div className="text-[11px] text-[var(--ink-faint)]">{t("penalty", { seconds: Math.round(standing.penaltyMs / 1000) })}</div>}
      </div>
    </li>
  );
}

function Standings({ room, now, title }: { room: RoomState; now: string; title: string }) {
  const table = rankRoom(room.players, room.rounds.length, now);
  return (
    <section className="w-full flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{title}</h2>
      <ol className="flex flex-col gap-2" data-testid="room-table">
        {table.map((standing, index) => (
          <StandingRow key={standing.player.id} standing={standing} place={index + 1} total={room.rounds.length} you={standing.player.id === room.you} host={standing.player.id === room.hostId} />
        ))}
      </ol>
    </section>
  );
}

function Invite({ room }: { room: RoomState }) {
  const t = useTranslations("online.room");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const send = async (viaShareSheet: boolean) => {
    const url = inviteUrl(room.code);
    if (viaShareSheet) {
      const outcome = await share({ title: t("title"), text: t("shareText", { rounds: room.rounds.length }), url });
      if (outcome === "copied") setCopied(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access. The link is on screen and can be selected by hand.
    }
  };

  return (
    <section className="mg-card" data-testid="room-invite">
      <div>
        <h2 className="font-semibold">{t("inviteTitle")}</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("inviteBody")}</p>
      </div>
      <input className="mg-field text-sm" readOnly value={typeof window === "undefined" ? "" : inviteUrl(room.code)} onFocus={(event) => event.target.select()} aria-label={t("copy")} data-testid="room-link" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="mg-button" onClick={() => send(false)} data-testid="room-copy">
          <CopyIcon /> <span aria-live="polite">{t(copied ? "copied" : "copy")}</span>
        </button>
        <button type="button" className="mg-button" data-variant="primary" onClick={() => send(true)} data-testid="room-share">
          <ShareIcon /> {t("share")}
        </button>
      </div>
    </section>
  );
}

/**
 * A challenge room, from the invitation to the final table. One page shows
 * every stage, because a link to the room has to make sense whenever it is
 * opened: before joining, in the lobby, during the race, and after it.
 */
export function RoomScreen({ code }: { code: string }) {
  const t = useTranslations("online.room");
  const online_ = useTranslations("online");
  const router = useRouter();
  const { room, error, serverNow, apply } = useRoom(code);
  const draft = useProfileDraft();
  const [busy, setBusy] = useState<"join" | "start" | "rematch" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useTicker(1_000, room?.status === "racing");

  const you = room?.players.find((player) => player.id === room.you) ?? null;
  const upcoming = room && you && room.status !== "lobby" ? nextRound(you, room.rounds.length) : null;

  // The host pressed start while this player was looking at the lobby: go straight to the first board. A page opened on a
  // race that was already running does not jump anywhere by itself, so the player can look at the table first.
  const sawLobby = useRef(false);
  useEffect(() => {
    if (!room) return;
    if (room.status === "lobby") sawLobby.current = true;
    else if (sawLobby.current && room.status === "racing" && upcoming === 0 && you && !you.startedAt) {
      sawLobby.current = false;
      router.push(roundPath(room.code, room.rounds, 0));
    }
  }, [room, router, upcoming, you]);

  const run = async (action: "join" | "start" | "rematch", work: () => Promise<void>) => {
    setBusy(action);
    setFailure(null);
    try {
      await work();
    } catch (problem) {
      setFailure(problem instanceof OnlineError ? problem.code : "offline");
    } finally {
      setBusy(null);
    }
  };

  const join = () =>
    run("join", async () => {
      const me = await draft.commit();
      rememberPlayer(me);
      apply(await online.joinRoom(code));
    });
  const start = () => run("start", async () => apply(await online.startRoom(code)));
  const rematch = () =>
    run("rematch", async () => {
      if (!room) return;
      const next = await online.createRoom(room.rounds, {}, room.code);
      router.push(roomPath(next.code));
    });
  const leave = async () => {
    await online.leaveRoom(code).catch(() => undefined);
    router.push("/");
  };

  if (error === "unavailable") return <OnlineUnavailable title={t("title")} />;

  if (!room) {
    return (
      <main className="mg-shell">
        <PageHeader title={t("title")} />
        {error === "no-room" ? (
          <div className="mg-card text-center" role="alert" data-testid="room-missing">
            <p className="font-semibold">{t("missingTitle")}</p>
            <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("missingBody")}</p>
            <Link href="/rooms/new" prefetch={false} className="mg-button" data-variant="primary">
              <UsersIcon /> {t("newRoom")}
            </Link>
          </div>
        ) : (
          <p className="mg-status" role="status">
            {error ? online_("offline") : t("loading")}
          </p>
        )}
      </main>
    );
  }

  const now = serverNow();
  const host = room.players.find((player) => player.id === room.hostId);
  const isHost = room.you !== null && room.you === room.hostId;
  const table = rankRoom(room.players, room.rounds.length, now);
  const winner = room.status === "finished" && table[0]?.state === "finished" ? table[0].player : null;

  return (
    <main className="mg-shell" data-testid="room" data-status={room.status}>
      <PageHeader title={t("code", { code: room.code })} />

      {failure && (
        <p className="w-full text-sm font-semibold text-[var(--invalid)]" role="alert" data-testid="room-error">
          {failure === "room-full" ? t("full") : failure === "room-finished" ? t("over") : online_("offline")}
        </p>
      )}

      {/* Not in the room yet: the invitation. */}
      {!you && room.status !== "finished" && (
        <section className="mg-card" data-testid="room-join">
          <h2 className="mg-display text-[22px] font-semibold leading-tight">{t("invited", { host: host?.name ?? "?" })}</h2>
          <ProfileFields draft={draft} disabled={busy === "join"} />
          <button type="button" className="mg-button" data-variant="primary" onClick={join} disabled={busy === "join" || !draft.valid} data-testid="room-join-button">
            <FlagIcon /> {t(busy === "join" ? "joining" : "join")}
          </button>
        </section>
      )}
      {!you && room.status === "finished" && <p className="w-full text-sm text-[var(--ink-soft)]">{t("over")}</p>}

      {/* In the lobby: bring people in, then start. */}
      {you && room.status === "lobby" && (
        <>
          <Invite room={room} />
          <section className="w-full flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{t("players", { count: room.players.length })}</h2>
            <ul className="flex flex-col gap-2" data-testid="room-players">
              {room.players.map((player) => (
                <li key={player.id} className="mg-row" data-you={player.id === room.you || undefined}>
                  <PlayerAvatar seed={player.avatar} size={36} />
                  <span className="font-semibold truncate flex-1" data-testid="room-player-name">
                    {player.name}
                  </span>
                  {player.id === room.you && <span className="mg-tag">{t("you")}</span>}
                  {player.id === room.hostId && <span className="mg-tag">{t("host")}</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Racing: the way back to the board, or the wait for the others. */}
      {you && room.status !== "lobby" && upcoming !== null && (
        <section className="mg-card" data-testid="room-racing">
          <h2 className="mg-display text-[22px] font-semibold leading-tight">{t("onTitle")}</h2>
          <Link href={roundPath(room.code, room.rounds, upcoming)} prefetch={false} className="mg-button justify-between" data-variant="primary" data-testid="room-go">
            {t("goToRound", { round: upcoming + 1 })} <ArrowRightIcon />
          </Link>
        </section>
      )}
      {you && room.status === "racing" && upcoming === null && (
        <p className="mg-status" data-kind="info" role="status">
          {t("waitingOthers")}
        </p>
      )}

      {winner && (
        <p className="w-full flex items-center justify-center gap-2 mg-display text-[22px] font-semibold" data-testid="room-winner">
          <TrophyIcon className="w-6 h-6 text-[var(--accent)]" /> {t("winner", { name: winner.name })}
        </p>
      )}

      {room.status !== "lobby" && <Standings room={room} now={now} title={t(room.status === "finished" ? "finalTitle" : "tableTitle")} />}

      <RoundList rounds={room.rounds} />

      {you && room.status === "lobby" && (
        <section className="w-full flex flex-col gap-2.5">
          {isHost ? (
            <>
              <button type="button" className="mg-button" data-variant="primary" onClick={start} disabled={busy === "start"} data-testid="room-start">
                <FlagIcon /> {t(busy === "start" ? "starting" : "start")}
              </button>
              {room.players.length === 1 && <p className="text-sm text-[var(--ink-soft)] text-center">{t("startAlone")}</p>}
            </>
          ) : (
            <p className="mg-status" role="status" data-testid="room-waiting">
              {t("waiting", { host: host?.name ?? "?" })}
            </p>
          )}
          <p className="text-xs text-[var(--ink-faint)] leading-relaxed">
            {t("clockNote")} {online_("race.rules")}
          </p>
          <button type="button" className="text-sm underline underline-offset-2 text-[var(--ink-soft)] self-center" onClick={leave} data-testid="room-leave">
            {t("leave")}
          </button>
        </section>
      )}

      {/* After the race: another one with the same settings, announced to everyone still looking at this table. */}
      {room.status === "finished" && (
        <section className="w-full flex flex-col gap-2.5">
          {room.rematchCode ? (
            <Link href={roomPath(room.rematchCode)} prefetch={false} className="mg-button justify-between" data-variant="primary" data-testid="room-rematch-join">
              <span>
                {t("rematchOpen", { host: host?.name ?? "?" })} {t("rematchJoin")}
              </span>
              <ArrowRightIcon />
            </Link>
          ) : isHost ? (
            <button type="button" className="mg-button" data-variant="primary" onClick={rematch} disabled={busy === "rematch"} data-testid="room-rematch">
              <FlagIcon /> {t("rematch")}
            </button>
          ) : null}
          <Link href="/rooms/new" prefetch={false} className="mg-button">
            <UsersIcon /> {t("newRoom")}
          </Link>
        </section>
      )}

      <footer className="mg-footer w-full pt-2 flex flex-wrap items-center justify-center gap-x-2 text-xs text-[var(--ink-faint)]">
        <Link href="/" prefetch={false} className="underline underline-offset-2 hover:text-[var(--ink-soft)]">
          {t("home")}
        </Link>
      </footer>
    </main>
  );
}
