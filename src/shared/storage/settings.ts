import type { GameId } from "@/games/registry";

/**
 * Small preferences live in localStorage. Boards, results and best times go
 * through IndexedDB in ./idb.ts. Reads and writes are guarded because
 * localStorage throws in some private-browsing modes.
 */
export type Settings = {
  sound: boolean;
  haptics: boolean;
  /** Games whose first-visit tutorial has been seen. */
  tutorials: Partial<Record<GameId, boolean>>;
};

export const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, tutorials: {} };

const STORAGE_KEY = "minigames:settings:v1";

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_SETTINGS };
    const stored = parsed as Record<string, unknown>;
    const flag = (key: "sound" | "haptics"): boolean => (typeof stored[key] === "boolean" ? (stored[key] as boolean) : DEFAULT_SETTINGS[key]);
    const tutorials: Settings["tutorials"] = {};
    if (typeof stored.tutorials === "object" && stored.tutorials !== null) {
      for (const [game, seen] of Object.entries(stored.tutorials as Record<string, unknown>)) {
        if (seen === true) tutorials[game as GameId] = true;
      }
    }
    return { sound: flag("sound"), haptics: flag("haptics"), tutorials };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or storage disabled. Settings stay in memory for this session.
  }
}
