/**
 * Locale configuration: the supported interface languages, the default one and
 * what each needs for `<html lang>`, Open Graph and the language switcher.
 * No side effects, so the proxy, server components, client components and
 * tests can all import it.
 */
export const LOCALES = ["en", "pt-br"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_META: Record<Locale, { htmlLang: string; ogLocale: string; hreflang: string; nativeLabel: string; shortLabel: string; flag: "us" | "br" }> = {
  // The URL segment is lower case. `htmlLang` and `hreflang` use the BCP 47 casing crawlers expect.
  en: { htmlLang: "en", ogLocale: "en_US", hreflang: "en", nativeLabel: "English", shortLabel: "EN", flag: "us" },
  "pt-br": { htmlLang: "pt-BR", ogLocale: "pt_BR", hreflang: "pt-BR", nativeLabel: "Português (Brasil)", shortLabel: "PT", flag: "br" },
};

/** The same cookie next-intl reads, so the proxy and the switcher agree on one name. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The locale a path starts with, or null: "/pt-br/zip" gives "pt-br". */
export function localeOfPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1] ?? "";
  return isLocale(first) ? first : null;
}

/** "/zip" in "pt-br" is "/pt-br/zip". The hub is "/pt-br", with no trailing slash. */
export function localizePath(locale: Locale, pathname: string): string {
  const path = pathname === "/" ? "" : pathname;
  return `/${locale}${path.startsWith("/") || path === "" ? path : `/${path}`}`;
}
