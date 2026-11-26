import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GAMES, type GameId, PLATFORM_NAME } from "@/games/registry";
import { LOCALES, LOCALE_META, type Locale, isLocale, localizePath } from "@/i18n/config";

/**
 * Canonical address and language alternates of a page. `path` is the route
 * without a locale: "/" or "/zip". Each locale is its own canonical page, and
 * `x-default` is the bare path, which the proxy sends to the visitor's locale.
 */
export function localizedAlternates(locale: Locale, path: string): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = { "x-default": path };
  for (const other of LOCALES) languages[LOCALE_META[other].hreflang] = localizePath(other, path);
  return { canonical: localizePath(locale, path), languages };
}

export function openGraphLocales(locale: Locale): { locale: string; alternateLocale: string[] } {
  return { locale: LOCALE_META[locale].ogLocale, alternateLocale: LOCALES.filter((other) => other !== locale).map((other) => LOCALE_META[other].ogLocale) };
}

/** Metadata of a game's pages: title, description, icon, canonical address and social card, in the page's language. */
export async function gameMetadata(locale: string, id: GameId): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const game = GAMES[id];
  const [t, games] = await Promise.all([getTranslations({ locale, namespace: "metadata" }), getTranslations({ locale, namespace: "games" })]);
  const name = games(`${id}.name`);
  const title = t("daily", { game: name });
  const description = t(`games.${id}`);
  const alternates = localizedAlternates(locale, game.path);
  const image = { url: `/og/${id}.png`, width: 1200, height: 630, alt: t("imageAlt", { game: name, tagline: games(`${id}.tagline`) }) };
  return {
    title: { default: title, template: `%s | ${name}` },
    description,
    alternates,
    icons: { icon: [{ url: `/icons/${id}.svg`, type: "image/svg+xml" }] },
    // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
    openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: alternates.canonical, ...openGraphLocales(locale), images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/** Title of a page under a game: its practice setup, or a seeded puzzle. The game's layout adds the game's name. */
export async function pageTitle(locale: string, page: "practice" | "play"): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t(page) };
}

/** Metadata of the pages that are not games: a room, the room setup, the ranking, the profile and the two legal pages. */
export async function onlineMetadata(locale: string, page: "room" | "roomNew" | "ranking" | "profile" | "privacy" | "terms", path: string): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t(`online.${page}.title`), description: t(`online.${page}.description`), alternates: localizedAlternates(locale, path) };
}
