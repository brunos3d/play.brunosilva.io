import { DEFAULT_LOCALE, type Locale, isLocale } from "./config";

/** Countries whose visitors start in Portuguese when nothing else says otherwise. */
const PORTUGUESE_COUNTRIES = new Set(["BR"]);

/** Languages of an Accept-Language header, best first: "pt-BR,pt;q=0.9,en;q=0.8" gives ["pt-br", "pt", "en"]. */
export function acceptedLanguages(header: string): string[] {
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params.map((param) => /^\s*q=([0-9.]+)\s*$/.exec(param)?.[1]).find((value) => value !== undefined);
      const q = quality === undefined ? 1 : Number(quality);
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry) => entry.tag !== "" && entry.tag !== "*" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((entry) => entry.tag);
}

/** The locale that serves a language tag, or null: any Portuguese reads "pt-br", any English reads "en". */
function localeForLanguage(tag: string): Locale | null {
  const base = tag.split("-")[0];
  if (base === "pt") return "pt-br";
  if (base === "en") return "en";
  return null;
}

/**
 * The locale a visitor starts in when the URL does not name one.
 *
 *  1. The cookie: the visitor already chose, here or with the switcher.
 *  2. Vercel's geolocation header: a visitor in Brazil starts in Portuguese.
 *  3. The browser's Accept-Language, best match first.
 *  4. English.
 *
 * It runs for paths without a locale only. A URL that names a locale is
 * served in that locale, whatever the country and the browser say.
 */
export function detectLocale(headers: Headers, cookieValue?: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;

  const country = headers.get("x-vercel-ip-country")?.toUpperCase();
  if (country && PORTUGUESE_COUNTRIES.has(country)) return "pt-br";

  const accept = headers.get("accept-language");
  if (accept) {
    for (const tag of acceptedLanguages(accept)) {
      const locale = localeForLanguage(tag);
      if (locale) return locale;
    }
  }
  return DEFAULT_LOCALE;
}
