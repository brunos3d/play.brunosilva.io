import { GAMES, type GameId } from "@/games/registry";
import { DIFFICULTIES } from "@/shared/engine/difficulty";

/** The one canonical address of the platform. Everything else redirects here. */
export const SITE_ORIGIN = "https://play.brunosilva.io";

/** Source code. Linked from the hub and from every game's footer. */
export const REPOSITORY_URL = "https://github.com/brunos3d/play.brunosilva.io";

/** Shortcut domains. Each opens its game on the canonical address. */
export const GAME_HOSTS: Record<string, GameId> = {
  "zip.brunosilva.io": "zip",
  "patches.brunosilva.io": "patches",
};

/** First path segments that already mean something on the canonical address, so they are kept as they are. */
const KNOWN_ROOTS = new Set<string>([...Object.values(GAMES).map((game) => game.path.slice(1)), ...DIFFICULTIES]);

/**
 * Where a request to a shortcut domain should go, or null when the host is not
 * one of them. The target origin is a constant, so a forged Host header can
 * only ever send a visitor to this site.
 *
 *   zip.brunosilva.io/                 -> play.brunosilva.io/zip
 *   zip.brunosilva.io/practice         -> play.brunosilva.io/zip/practice
 *   zip.brunosilva.io/play?seed=7      -> play.brunosilva.io/zip/play?seed=7
 *   zip.brunosilva.io/hard/42          -> play.brunosilva.io/hard/42   (old Zip link, redirected again there)
 *   zip.brunosilva.io/patches          -> play.brunosilva.io/patches   (already a full path)
 */
export function resolveHostRedirect(host: string | null | undefined, pathname: string, search = ""): string | null {
  if (!host) return null;
  const name = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const game = GAME_HOSTS[name];
  if (!game) return null;

  const path = pathname.replace(/\/+$/, "");
  const root = path.split("/")[1] ?? "";
  const target = path === "" ? GAMES[game].path : KNOWN_ROOTS.has(root) ? path : `${GAMES[game].path}${path}`;
  return `${SITE_ORIGIN}${target}${search}`;
}
