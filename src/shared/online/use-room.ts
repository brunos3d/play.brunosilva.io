"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OnlineError, online } from "./api";
import type { RoomState } from "./types";

/** How often a visible page asks for the room. A second and a half keeps a lobby and a race feeling live, and is far from heavy for a handful of players. */
const POLL_VISIBLE_MS = 1_500;
/** A hidden tab still shows up as present, without asking as often. */
const POLL_HIDDEN_MS = 8_000;

export type RoomView = {
  room: RoomState | null;
  /** The server's code for why there is no room to show: "no-room", "unavailable", "offline". */
  error: string | null;
  /** The server's clock as an ISO string, moved forward by the time since the last answer. Race clocks are measured against it, never against the device's own clock. */
  serverNow: () => string;
  /** Replaces the room with a fresher one, as returned by an action. */
  apply: (room: RoomState) => void;
  refresh: () => void;
};

/**
 * Keeps a room up to date by asking for it on a timer.
 *
 * Polling, not a socket: a room changes a few times a minute (someone joins,
 * the host starts, someone ends a round), so a request every second or two
 * shows every change soon enough, and it needs nothing but plain HTTP. It
 * works through any proxy or mobile network, survives a function restarting,
 * and a missed answer heals itself on the next tick. docs/MULTIPLAYER.md
 * compares it with WebSockets and WebRTC.
 */
export function useRoom(code: string | null): RoomView {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Server time minus device time, in milliseconds, from the latest answer. */
  const offset = useRef(0);
  const refresh = useRef<() => void>(() => undefined);

  const apply = useCallback((next: RoomState) => {
    offset.current = new Date(next.now).getTime() - Date.now();
    setRoom(next);
    setError(null);
  }, []);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    let timer = 0;
    const tick = async (): Promise<void> => {
      window.clearTimeout(timer);
      try {
        const next = await online.room(code);
        if (!alive) return;
        apply(next);
      } catch (failure) {
        if (!alive) return;
        const reason = failure instanceof OnlineError ? failure.code : "offline";
        setError(reason);
        // A room that does not exist will not start existing. Anything else is worth another try.
        if (reason === "no-room" || reason === "unavailable") return;
      }
      timer = window.setTimeout(tick, document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS);
    };
    refresh.current = () => void tick();
    timer = window.setTimeout(tick, 0);
    // Coming back to the tab asks at once, so a player never looks at a stale race.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply, code]);

  const serverNow = useCallback(() => new Date(Date.now() + offset.current).toISOString(), []);
  return { room, error, serverNow, apply, refresh: () => refresh.current() };
}

/** A value that re-renders its caller every `intervalMs`, for clocks that count against `serverNow`. */
export function useTicker(intervalMs: number, active = true): number {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setBeat((value) => value + 1), intervalMs);
    return () => window.clearInterval(interval);
  }, [active, intervalMs]);
  return beat;
}
