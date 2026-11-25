"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { OnlineError, online } from "./api";
import { randomAvatarSeed, randomPlayerName } from "./names";
import type { Me } from "./types";

/**
 * The player of this device, shared by every component that shows it. It is
 * read from the server once per page load. `undefined` means not asked yet,
 * `null` that the device has no player, which is the normal state until it
 * first joins a room or scores a daily puzzle.
 */
type Store = { me: Me | null | undefined; unavailable: boolean };

let store: Store = { me: undefined, unavailable: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const SERVER: Store = { me: undefined, unavailable: false };

function set(next: Partial<Store>): void {
  store = { ...store, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): Promise<void> {
  loading ??= online
    .me()
    .then((me) => set({ me, unavailable: false }))
    .catch((error: unknown) => {
      // No database behind this deployment: the online features hide themselves. A network error is not that, and is retried on the next page.
      if (error instanceof OnlineError && error.code === "unavailable") set({ me: null, unavailable: true });
      else loading = null;
    });
  return loading;
}

/** For code outside React that has just learned who the player is, such as a room that created one on join. */
export function rememberPlayer(me: Me): void {
  set({ me, unavailable: false });
}

export function usePlayer(): {
  /** The player, null when the device has none, undefined while the answer is on its way. */
  me: Me | null | undefined;
  /** True when this deployment has no database. Rooms and rankings are then not offered at all. */
  unavailable: boolean;
  /** A name and an avatar for a player about to be created, in the page's language. */
  suggestion: () => { name: string; avatar: string; locale: string };
  /** The player, created now if the device has none. */
  ensure: () => Promise<Me>;
  update: (patch: { name?: string; avatar?: string }) => Promise<Me>;
} {
  const locale = useLocale();
  const state = useSyncExternalStore(subscribe, () => store, () => SERVER);
  useEffect(() => {
    void load();
  }, []);

  const suggestion = useCallback(() => ({ name: randomPlayerName(locale), avatar: randomAvatarSeed(), locale }), [locale]);
  const ensure = useCallback(async () => {
    if (store.me) return store.me;
    const me = await online.ensureMe(suggestion());
    rememberPlayer(me);
    return me;
  }, [suggestion]);
  const update = useCallback(async (patch: { name?: string; avatar?: string }) => {
    const me = await online.updateMe(patch);
    rememberPlayer(me);
    return me;
  }, []);

  return { me: state.me, unavailable: state.unavailable, suggestion, ensure, update };
}
