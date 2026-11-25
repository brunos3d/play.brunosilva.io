import { GAMES, type GameId } from "@/games/registry";
import { LOCALES } from "@/i18n/config";
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
const KNOWN_ROOTS = new Set<string>([...Object.values(GAMES).map((game) => game.path.slice(1)), ...DIFFICULTIES, ...LOCALES]);

/**
 * True for a path that is a page, and so lives under a locale. Files do not:
 * anything with an extension (sw.js, manifest.webmanifest, icons, Open Graph
 * images) and Next.js internals are served from the root as they are.
 */
export function isPagePath(pathname: string): boolean {
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/") || pathname === "/api") return false;
  // An old Zip link is /<difficulty>/<seed>, and its seed may hold a dot.
  if ((DIFFICULTIES as readonly string[]).includes(pathname.split("/")[1] ?? "")) return true;
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return !/\.[A-Za-z0-9]+$/.test(last);
}

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
 *   zip.brunosilva.io/pt-br/zip        -> play.brunosilva.io/pt-br/zip (already has a locale)
 *
 * The target never carries a locale of its own: this redirect is permanent and
 * cached, and the locale depends on the visitor. The proxy adds it in a second
 * step on the canonical address.
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
