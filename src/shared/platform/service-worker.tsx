"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { warmOfflineData } from "@/games/offline";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { refreshPush } from "./push-client";

const SERVICE_WORKER_URL = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";

/**
 * Registers the offline worker and tells it which locale the player is in, so
 * it caches the pages of that locale (see public/sw.js). It then fetches the
 * word data of the player's game language, which the worker caches on the way.
 * Production only: in development the worker would serve stale bundles and
 * fight hot reload.
 */
export function ServiceWorker() {
  const locale = useLocale();
  const { language, ready } = useGameLanguage();
  useEffect(() => {
    // The stored game language is not known before hydration. Waiting for it avoids warming the wrong one.
    if (!ready) return;
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const register = () => {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (cancelled) return;
          registration.active?.postMessage({ type: "precache", locale });
          // A device with reminders on tells the server its language and time zone again, in case either changed.
          void refreshPush(locale);
          // The word data of the player's game language, fetched while idle so it never competes with the page itself.
          // It only reaches the worker's cache once the worker controls this page, which on a first visit is a moment after it activates.
          const warm = () => {
            if (cancelled) return;
            // The attribute says the word data is in. The offline test waits for it, since nothing else on the page shows it.
            const fetchData = () => void warmOfflineData(language).then(() => document.documentElement.setAttribute("data-offline-words", language));
            if (navigator.serviceWorker.controller) fetchData();
            else navigator.serviceWorker.addEventListener("controllerchange", fetchData, { once: true });
          };
          if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 4_000 });
          else setTimeout(warm, 1_500);
        })
        .catch(() => {
          // Offline support is an enhancement. The game works without it.
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, [language, locale, ready]);
  return null;
}
