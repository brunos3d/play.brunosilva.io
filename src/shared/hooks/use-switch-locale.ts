"use client";

import { useLocale } from "next-intl";
import { useCallback, useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Changes the interface language and stays on the same page: /en/zip/play?seed=7
 * becomes /pt-br/zip/play?seed=7. The choice goes into the cookie the proxy
 * reads, so the next visit to a bare path opens in it too.
 *
 * It does not touch the game language. That is a setting of its own.
 */
export function useSwitchLocale(): { locale: Locale; pending: boolean; switchTo: (next: Locale) => void } {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const switchTo = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      // The query string names the puzzle on the play route, so it travels along.
      const target = `${pathname}${window.location.search}`;
      startTransition(() => router.replace(target, { locale: next, scroll: false }));
    },
    [locale, pathname, router],
  );

  return { locale, pending, switchTo };
}
