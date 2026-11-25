"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";

/**
 * Registers the offline worker and tells it which locale the player is in, so
 * it caches the pages of that locale (see public/sw.js). Production only: in
 * development the worker would serve stale bundles and fight hot reload.
 */
export function ServiceWorker() {
  const locale = useLocale();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const register = () => {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (!cancelled) registration.active?.postMessage({ type: "precache", locale });
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
  }, [locale]);
  return null;
}
