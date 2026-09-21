"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { GameId } from "@/games/registry";
import { DEFAULT_SETTINGS, type Settings, loadSettings, saveSettings } from "@/shared/storage/settings";

/**
 * Settings as an external store. The server snapshot is the defaults, so
 * hydration never mismatches, and the real values arrive on the first client
 * render without an effect.
 */
let cached: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cached === null) cached = loadSettings();
  return cached;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(next: Settings): void {
  cached = next;
  saveSettings(next);
  for (const listener of listeners) listener();
}

const noopSubscribe = () => () => undefined;

/** False during server rendering and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useSettings(): { settings: Settings; update: (patch: Partial<Settings>) => void; markTutorialSeen: (game: GameId) => void } {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
  const update = useCallback((patch: Partial<Settings>) => write({ ...read(), ...patch }), []);
  const markTutorialSeen = useCallback((game: GameId) => {
    const current = read();
    if (!current.tutorials[game]) write({ ...current, tutorials: { ...current.tutorials, [game]: true } });
  }, []);
  return { settings, update, markTutorialSeen };
}
