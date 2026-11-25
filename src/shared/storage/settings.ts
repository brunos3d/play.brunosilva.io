import type { GameId } from "@/games/registry";
import { type GameLanguage, isGameLanguage } from "@/i18n/game-language";

/**
 * Small preferences live in localStorage. Boards, results and best times go
 * through IndexedDB in ./idb.ts. Reads and writes are guarded because
 * localStorage throws in some private-browsing modes.
 *
 * The interface language is not here. It is part of the URL, and the choice is
 * remembered in a cookie the server can read (see src/proxy.ts).
 */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type Settings = {
  sound: boolean;
  haptics: boolean;
  /** "system" follows the device. The other two override it. */
  theme: Theme;
  /**
   * The language of the words in Termo and Wend and of the chess coach. Null
   * until the player picks one, and the games then follow the interface.
   */
  gameLanguage: GameLanguage | null;
  /** Games whose first-visit tutorial has been seen. */
  tutorials: Partial<Record<GameId, boolean>>;
};

export const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, theme: "system", gameLanguage: null, tutorials: {} };

/** Also read by the inline script in src/shared/ui/theme-script.tsx, which sets the theme before the first paint. */
export const SETTINGS_STORAGE_KEY = "minigames:settings:v1";

const isTheme = (value: unknown): value is Theme => typeof value === "string" && (THEMES as readonly string[]).includes(value);

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
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
    return {
      sound: flag("sound"),
      haptics: flag("haptics"),
      theme: isTheme(stored.theme) ? stored.theme : DEFAULT_SETTINGS.theme,
      gameLanguage: isGameLanguage(stored.gameLanguage) ? stored.gameLanguage : null,
      tutorials,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or storage disabled. Settings stay in memory for this session.
  }
}
