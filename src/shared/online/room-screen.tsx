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
import { ArrowRightIcon, CopyIcon, FlagIcon, ShareIcon, TrophyIcon, UsersIcon } from "@/shared/ui/icons";
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
            <li key={index} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
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

/**
 * One row of the table. The first line has the place, the player, how far they
 * are and their time. Under it, one cell per round played says how long the
 * round took, so the table also answers "where did I lose it?".
 */
function StandingRow({ standing, place, rounds, fastest, you, host }: { standing: Standing; place: number; rounds: readonly RoundConfig[]; fastest: readonly (number | null)[]; you: boolean; host: boolean }) {
  const t = useTranslations("online.room");
  const text = useGameText();
  const { player, state } = standing;
  const total = rounds.length;
  const progress = state === "gave-up" ? t("stateGaveUp") : state === "waiting" ? t("stateWaiting") : state === "racing" ? t("stateRacing", { round: Math.min(standing.played + 1, total), total }) : null;
  const splits = standing.splitsMs.slice(0, total);
  return (
    <li className="mg-row" data-detail={splits.length > 0 || undefined} data-you={you || undefined} data-state={state} data-testid="room-standing">
      <span className="mg-rank">{place}</span>
      <PlayerAvatar seed={player.avatar} size={36} />
      <div className="min-w-0 flex-1">
        <div className="mg-player-line">
          <span className="mg-player-name" data-testid="room-player-name">
            {player.name}
          </span>
          {you && <span className="mg-tag">{t("you")}</span>}
          {host && <span className="mg-tag">{t("host")}</span>}
          {standing.away && state !== "finished" && state !== "gave-up" && <span className="mg-tag">{t("away")}</span>}
        </div>
        {/* Each piece stays whole. Together they take a second line when the row is narrow. */}
        <div className="flex flex-wrap gap-x-2.5 text-xs text-[var(--ink-soft)] whitespace-nowrap">
          {progress && <span>{progress}</span>}
          {(standing.played > 0 || !progress) && <span>{t("solved", { solved: standing.solved, total })}</span>}
          {standing.penaltyMs > 0 && (
            <span className="text-[var(--hint)]" data-testid="room-penalty">
              {t("penalty", { seconds: Math.round(standing.penaltyMs / 1000) })}
            </span>
          )}
        </div>
      </div>
      <div className="font-semibold tabular-nums flex-none whitespace-nowrap" data-testid="room-time">
        {standing.timeMs === null ? "--:--" : formatTime(standing.timeMs)}
      </div>
      {splits.length > 0 && (
        <ol className="mg-splits" aria-label={t("splits")} data-testid="room-splits">
          {splits.map((split, index) => {
            const solved = player.results[index].solved;
            const game = rounds[index].game;
            const time = formatTime(split);
            return (
              <li key={index} className="mg-split" data-solved={solved} data-best={(solved && fastest[index] === split) || undefined} aria-label={t(solved ? "splitSolved" : "splitMissed", { round: index + 1, game: text.name(game), time })} data-testid="room-split">
                <GameIcon game={game} />
                <span aria-hidden="true">{time}</span>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function Standings({ room, now, title }: { room: RoomState; now: string; title: string }) {
  const table = rankRoom(room.players, room.rounds.length, now);
  // The fastest solve of each round, marked in the rows. With one player there is nobody to be faster than.
  const fastest = room.rounds.map((_, index) => {
    const solves = table.filter((standing) => standing.player.results[index]?.solved && standing.splitsMs[index] !== undefined).map((standing) => standing.splitsMs[index]);
    return table.length > 1 && solves.length > 0 ? Math.min(...solves) : null;
  });
  return (
    <section className="w-full flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{title}</h2>
      <ol className="flex flex-col gap-2" data-testid="room-table">
        {table.map((standing, index) => (
          <StandingRow key={standing.player.id} standing={standing} place={index + 1} rounds={room.rounds} fastest={fastest} you={standing.player.id === room.you} host={standing.player.id === room.hostId} />
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

  const url = typeof window === "undefined" ? "" : inviteUrl(room.code);
  return (
    <section className="mg-card" data-testid="room-invite">
      <div>
        <h2 className="font-semibold">{t("inviteTitle")}</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("inviteBody")}</p>
      </div>
      {/* The link as text, so it shows whole on any phone: an input would cut it. The address bar already says it is https. */}
      <p className="mg-link-box" data-url={url} data-testid="room-link">
        {url.replace(/^https?:\/\//, "")}
      </p>
      <div className="mg-actions" data-even="true">
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
                  <div className="mg-player-line flex-1">
                    <span className="mg-player-name" data-testid="room-player-name">
                      {player.name}
                    </span>
                    {player.id === room.you && <span className="mg-tag">{t("you")}</span>}
                    {player.id === room.hostId && <span className="mg-tag">{t("host")}</span>}
                  </div>
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
        <p className="w-full flex items-center justify-center gap-2 mg-display text-[22px] font-semibold leading-tight" data-testid="room-winner">
          <TrophyIcon className="w-6 h-6 flex-none text-[var(--accent)]" /> <span className="min-w-0 [overflow-wrap:anywhere]">{t("winner", { name: winner.name })}</span>
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
          <button type="button" className="mg-text-link text-sm text-[var(--ink-soft)] self-center" onClick={leave} data-testid="room-leave">
            {t("leave")}
          </button>
        </section>
      )}

      {/* After the race: another one with the same settings, announced to everyone still looking at this table. */}
      {room.status === "finished" && (
        <section className="w-full flex flex-col gap-2.5">
          {room.rematchCode ? (
            // The news is a sentence and the button is a verb: together in one button they broke into three lines on a phone.
            <div className="mg-card" style={{ gap: 10, padding: 14 }} role="status">
              <p className="font-semibold leading-snug">{t("rematchOpen", { host: host?.name ?? "?" })}</p>
              <Link href={roomPath(room.rematchCode)} prefetch={false} className="mg-button justify-between" data-variant="primary" data-testid="room-rematch-join">
                {t("rematchJoin")} <ArrowRightIcon />
              </Link>
            </div>
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
        <Link href="/" prefetch={false} className="mg-text-link">
          {t("home")}
        </Link>
      </footer>
    </main>
  );
}
