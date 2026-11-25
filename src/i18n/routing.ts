import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./config";

/**
 * Every page lives under a locale: /en/zip, /pt-br/zip. A path without one is
 * redirected by the proxy (src/proxy.ts), which is also where the visitor's
 * language is detected.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeCookie: { name: LOCALE_COOKIE, maxAge: LOCALE_COOKIE_MAX_AGE },
});
