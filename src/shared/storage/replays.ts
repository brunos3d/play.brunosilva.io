import type { GameId } from "@/games/registry";

/**
 * Practice puzzles the player has started over with "Try again". A replay is
 * played with the answer already seen, so it must not set a best time. The list
 * lives in localStorage next to the settings: it is small, and it has to be
 * readable at once when a result is built.
 */
const STORAGE_KEY = "minigames:replays:v1";
/** Old entries fall off the end. A puzzle replayed that long ago is unlikely to be opened again. */
const LIMIT = 300;

const entry = (game: GameId, seed: string): string => `${game}|${seed}`;

function read(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function markReplay(game: GameId, seed: string): void {
  if (typeof localStorage === "undefined") return;
  const key = entry(game, seed);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([key, ...read().filter((item) => item !== key)].slice(0, LIMIT)));
  } catch {
    // Quota exceeded or storage disabled. The replay then counts like a first try on this device.
  }
}

export const isReplay = (game: GameId, seed: string): boolean => read().includes(entry(game, seed));
