/*
 * Platform offline worker. Scope: the whole site.
 *
 * Every puzzle is generated on the device, so offline play only needs the app
 * shell: the pages below plus the hashed files they reference.
 *
 * - Install: fetch each page, cache it, then cache every /_next/static file the
 *   HTML mentions. This covers the first visit, when the page loaded before the
 *   worker could see its requests.
 * - Navigations: network first, cached page as fallback. The query string is
 *   ignored on fallback because /zip/play?seed=... is one page for all seeds.
 * - /_next/static, icons and the manifest: cache first. Those URLs are
 *   content-hashed or change only with a release.
 * - React Server Component payloads are never cached. They share a URL with
 *   the HTML page, and serving one for the other would break the app. Offline,
 *   the failed fetch makes Next.js fall back to a full navigation, which the
 *   cached page answers.
 */
const CACHE = "minigames-shell-v1";
const PAGES = ["/", "/zip", "/zip/practice", "/zip/play", "/patches", "/patches/practice", "/patches/play"];
const EXTRAS = ["/manifest.webmanifest", "/icons/platform.svg", "/icons/zip.svg", "/icons/patches.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const STATIC_ASSET = /\/_next\/static\/[^"'\\\s)<>]+/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set(EXTRAS);
  for (const page of PAGES) {
    try {
      const response = await fetch(page, { credentials: "same-origin" });
      if (!response.ok) continue;
      await cache.put(page, response.clone());
      for (const match of (await response.text()).match(STATIC_ASSET) ?? []) assets.add(match);
    } catch {
      // A page that fails now is cached on its first online visit instead.
    }
  }
  await Promise.all(
    [...assets].map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Skip. Cache-first fills the gap later.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => (key.startsWith("minigames-") || key.startsWith("patches-")) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function pageFromNetwork(request) {
  const cache = await caches.open(CACHE);
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  try {
    const response = await fetch(request);
    if (response.ok && PAGES.includes(path)) await cache.put(path, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(path)) ?? (await cache.match("/"));
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
