"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { SEED_CODECS } from "@/games/codecs";
import { useRouter } from "@/i18n/navigation";
import { online } from "./api";
import { nextRound, normalizeRoomCode, roomPath, roundPath, roundSpec } from "./rooms";
import type { RoomPlayer, RoomState } from "./types";
import { useRoom } from "./use-room";

/**
 * A puzzle played as a round of a challenge room. The game's page is the
 * ordinary seeded route with two more query parameters, `room` and `round`, so
 * no game knows about rooms: the shared game frame reads them here and reports
 * to the room what the player does.
 */
export type Race = {
  code: string;
  /** This page's round, from 0. */
  round: number;
  /** The room, once the first answer is in. */
  room: RoomState | null;
  you: RoomPlayer | null;
  serverNow: () => string;
  /** The board came into view. The first one starts the player's clock. */
  view: () => void;
  /** The round ended. Records it and moves on to the next round, or to the table after the last. */
  finishRound: (result: { solved: boolean; hints: number }) => void;
  /** Leaves this page for wherever the player belongs: their next round, or the room. */
  moveOn: () => void;
  giveUp: () => Promise<void>;
};

const noSubscription = () => () => undefined;

function parse(search: string): { code: string; round: number } | null {
  const params = new URLSearchParams(search);
  const code = normalizeRoomCode(params.get("room") ?? "");
  const round = Number(params.get("round"));
  return code && Number.isInteger(round) && round >= 1 && round <= 10 ? { code, round: round - 1 } : null;
}

/** How long a failed report waits before it is sent again. A round that was not recorded would stall the whole race for this player. */
const RETRY_MS = [600, 1_500, 3_000, 6_000];

export function useRace(): Race | null {
  // The query string of the page as it loaded. The frame is mounted once per puzzle, so it never changes under it.
  const search = useSyncExternalStore(noSubscription, () => window.location.search, () => "");
  const target = useMemo(() => parse(search), [search]);
  const { room, serverNow, apply } = useRoom(target?.code ?? null);
  const router = useRouter();
  const you = room?.players.find((player) => player.id === room.you) ?? null;
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const send = useCallback(
    async (progress: Parameters<typeof online.progress>[1]): Promise<RoomState | null> => {
      if (!target) return null;
      for (let attempt = 0; ; attempt++) {
        try {
          const next = await online.progress(target.code, progress);
          apply(next);
          return next;
        } catch {
          if (attempt >= RETRY_MS.length) return null;
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_MS[attempt]));
        }
      }
    },
    [apply, target],
  );

  const go = useCallback(
    (state: RoomState | null) => {
      if (!target) return;
      const me = state?.players.find((player) => player.id === state.you);
      const upcoming = state && me ? nextRound(me, state.rounds.length) : null;
      router.push(state && upcoming !== null && state.status !== "lobby" ? roundPath(state.code, state.rounds, upcoming) : roomPath(target.code));
    },
    [router, target],
  );

  const viewed = useRef(false);
  const view = useCallback(() => {
    if (!target || viewed.current) return;
    viewed.current = true;
    void send({ event: "view", round: target.round + 1 });
  }, [send, target]);

  const finishing = useRef(false);
  const finishRound = useCallback(
    (result: { solved: boolean; hints: number }) => {
      if (!target || finishing.current) return;
      finishing.current = true;
      void send({ event: "round", round: target.round + 1, ...result }).then((state) => go(state ?? roomRef.current));
    },
    [go, send, target],
  );

  const giveUp = useCallback(async () => {
    if (!target) return;
    await send({ event: "give-up" });
    router.push(roomPath(target.code));
  }, [router, send, target]);

  const moveOn = useCallback(() => go(roomRef.current), [go]);

  // This page only makes sense for a member of the room who is on this round. Anyone else belongs on the room's own page:
  // a visitor who has not joined, a player who gave up, a link to a round that is not theirs yet, a seed that is not the round's.
  const misplaced = useMemo(() => {
    if (!target || !room) return false;
    if (!you || room.status === "lobby" || you.gaveUp || target.round >= room.rounds.length) return true;
    if (target.round > you.results.length) return true;
    const round = room.rounds[target.round];
    return new URLSearchParams(search).get("seed") !== SEED_CODECS[round.game].format(roundSpec(round));
  }, [room, search, target, you]);
  useEffect(() => {
    if (misplaced && target) router.replace(roomPath(target.code));
  }, [misplaced, router, target]);

  return useMemo(() => (target ? { code: target.code, round: target.round, room, you, serverNow, view, finishRound, moveOn, giveUp } : null), [finishRound, giveUp, moveOn, room, serverNow, target, view, you]);
}
