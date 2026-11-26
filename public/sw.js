/*
 * Platform offline worker. Scope: the whole site.
 *
 * Every puzzle is generated on the device, so offline play only needs the app
 * shell: the pages below plus the hashed files they reference.
 *
 * - Pages live under a locale: /en/zip, /pt-br/zip. The page tells the worker
 *   which locale it is in (a "precache" message, see
 *   src/shared/platform/service-worker.tsx). The worker then fetches every page
 *   of that locale, caches it, and caches every /_next/static file the HTML
 *   mentions. Only the locale in use is fetched, once per worker version. The
 *   other one is cached page by page if the player ever switches.
 * - Navigations: network first, cached page as fallback. The query string is
 *   ignored on fallback because /en/zip/play?seed=... is one page for all
 *   seeds. A path without a locale (the start URL "/", a shortcut such as
 *   "/zip", an old link) is redirected by the server when online. Offline, the
 *   worker answers it with the page of the locale used last.
 * - /_next/static, icons and the manifest: cache first. Those URLs are
 *   content-hashed or change only with a release.
 * - React Server Component payloads are never cached. They share a URL with
 *   the HTML page, and serving one for the other would break the app. Offline,
 *   the failed fetch makes Next.js fall back to a full navigation, which the
 *   cached page answers.
 * - Push: the server sends a reminder as JSON, already written in the
 *   player's language: { title, body, url, tag }. The worker shows it, and a tap
 *   brings the app to the front on that URL.
 */
const CACHE = "minigames-shell-v6";
const LOCALES = ["en", "pt-br"];
const DEFAULT_LOCALE = "en";
/** Routes without their locale. "" is the hub. */
const ROUTES = ["", "/zip", "/zip/practice", "/zip/play", "/patches", "/patches/practice", "/patches/play", "/chess", "/chess/practice", "/chess/play", "/queens", "/queens/practice", "/queens/play", "/sumbreak", "/sumbreak/practice", "/sumbreak/play", "/wend", "/wend/practice", "/wend/play", "/termo", "/termo/practice", "/termo/play"];
const EXTRAS = ["/manifest.webmanifest", "/icons/platform.svg", "/icons/zip.svg", "/icons/patches.svg", "/icons/chess.svg", "/icons/queens.svg", "/icons/sumbreak.svg", "/icons/wend.svg", "/icons/termo.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const STATIC_ASSET = /\/_next\/static\/[^"'\\\s)<>]+/g;
/** Cache entries that are not pages: the locale used last, and one marker per locale whose pages are all in. */
const LOCALE_KEY = "/__sw/locale";
const doneKey = (locale) => `/__sw/precached/${locale}`;

const isPage = (path) => LOCALES.some((locale) => ROUTES.some((route) => path === `/${locale}${route}`));
const localeOf = (path) => LOCALES.find((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`));

async function cacheAssets(cache, urls) {
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Skip. Cache-first fills the gap later.
      }
    }),
  );
}

async function precache(locale) {
  const cache = await caches.open(CACHE);
  await cache.put(LOCALE_KEY, new Response(locale));
  if (await cache.match(doneKey(locale))) return;
  const assets = new Set();
  let complete = true;
  for (const route of ROUTES) {
    const page = `/${locale}${route}`;
    try {
      const response = await fetch(page, { credentials: "same-origin" });
      if (!response.ok) {
        complete = false;
        continue;
      }
      await cache.put(page, response.clone());
      for (const match of (await response.text()).match(STATIC_ASSET) ?? []) assets.add(match);
    } catch {
      // A page that fails now is cached on its first online visit instead, and the next message tries again.
      complete = false;
    }
  }
  await cacheAssets(cache, assets);
  if (complete) await cache.put(doneKey(locale), new Response("1"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cacheAssets(cache, EXTRAS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => (key.startsWith("minigames-") || key.startsWith("patches-")) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "precache" && LOCALES.includes(data.locale)) event.waitUntil(precache(data.locale));
});

async function lastLocale(cache) {
  const stored = await cache.match(LOCALE_KEY);
  const locale = stored ? await stored.text() : DEFAULT_LOCALE;
  return LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

async function pageFromNetwork(request) {
  const cache = await caches.open(CACHE);
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  try {
    const response = await fetch(request);
    if (response.ok && isPage(path)) await cache.put(path, response.clone());
    return response;
  } catch {
    // Offline. A path without a locale would have been redirected by the server: answer it with the locale used last.
    const locale = localeOf(path) ?? (await lastLocale(cache));
    const localized = localeOf(path) ? path : `/${locale}${path === "/" ? "" : path}`;
    const cached = (await cache.match(localized)) ?? (await cache.match(`/${locale}`));
    return cached ?? Response.error();
  }
}

async function assetFromCache(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isServerComponentPayload = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isServerComponentPayload) return;

  if (request.mode === "navigate") {
    event.respondWith(pageFromNetwork(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(assetFromCache(request));
  }
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // Not JSON. A push must still show something, or the browser shows its own "updated in the background" notice.
  }
  const title = typeof message.title === "string" && message.title ? message.title : "Minigames";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof message.body === "string" ? message.body : "",
      icon: "/icons/icon-192.png",
      // One reminder at a time: a new one replaces the last instead of piling up. It still makes itself noticed, since
      // the one it replaces may be yesterday's. `renotify` needs a tag that is not empty.
      tag: typeof message.tag === "string" && message.tag ? message.tag : "minigames",
      renotify: true,
      data: { url: typeof message.url === "string" ? message.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only a path of this site: the URL comes from a message, and a tap must never open anything else.
  const target = new URL(String((event.notification.data && event.notification.data.url) || "/"), self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    // Only windows this worker controls: it cannot navigate any other (a tab that was force-reloaded, say), and a tap
    // that does nothing is worse than a second window. Without one, the tap opens the site, inside the installed app
    // when there is one.
    self.clients.matchAll({ type: "window" }).then(async (windows) => {
      const open = windows[0];
      if (!open) return self.clients.openWindow(url);
      // Focus first, while the tap still allows it. Going to the address is best effort: the window is the site already.
      const focused = await open.focus().catch(() => open);
      await focused.navigate(url).catch(() => undefined);
    }),
  );
});
