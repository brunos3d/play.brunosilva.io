import { type NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale, localeOfPath, localizePath } from "@/i18n/config";
import { detectLocale } from "@/i18n/detect";
import { isPagePath, resolveHostRedirect } from "@/shared/platform/site";

/**
 * Two jobs, in this order.
 *
 * 1. Shortcut domains. The platform lives at play.brunosilva.io, and
 *    zip.brunosilva.io and patches.brunosilva.io open their game there. The
 *    rule is in shared/platform/site.ts, where it is unit tested. 308 keeps the
 *    method and tells browsers and search engines the move is permanent.
 *    Browsers cache it hard, so switch to 307 while experimenting with the
 *    domains.
 *
 * 2. Locales. Every page lives under /en or /pt-br. A page path without a
 *    locale is redirected to the visitor's: the one in their cookie, or the
 *    one detected from Vercel's country header and from Accept-Language (see
 *    i18n/detect.ts). That covers the bare domain, the PWA start URL and every
 *    link shared before the site had languages. A path that names a locale is
 *    served as it is. It becomes the visitor's stored choice only when they
 *    have none yet. After that, the language switcher is what changes it.
 *
 * Files (the service worker, the manifest, icons, images) have no locale and
 * pass through the second step untouched.
 */
const HOST_REDIRECT_STATUS = 308;
/** Temporary: where a bare path leads depends on who asks. */
const LOCALE_REDIRECT_STATUS = 307;

function rememberLocale(response: NextResponse, locale: string): void {
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
}

export function proxy(request: NextRequest) {
  // Behind Vercel's edge the public host arrives in x-forwarded-host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const { pathname, search } = request.nextUrl;
  const moved = resolveHostRedirect(host, pathname, search);
  if (moved) return NextResponse.redirect(moved, HOST_REDIRECT_STATUS);

  if (!isPagePath(pathname)) return NextResponse.next();

  const stored = request.cookies.get(LOCALE_COOKIE)?.value;
  const named = localeOfPath(pathname);
  if (named) {
    const response = NextResponse.next();
    // A first visit through a link that names a locale starts in that locale. A stored choice is never overwritten here:
    // pages of the other locale are also fetched in the background (prefetches, the service worker), and those must not undo what the visitor picked.
    if (!isLocale(stored)) rememberLocale(response, named);
    return response;
  }

  const locale = detectLocale(request.headers, stored);
  const target = request.nextUrl.clone();
  target.pathname = localizePath(locale, pathname.replace(/\/+$/, "") || "/");
  const response = NextResponse.redirect(target, LOCALE_REDIRECT_STATUS);
  rememberLocale(response, locale);
  // The target depends on the cookie, the country and the browser's languages. A shared cache must not pin one visitor's answer for everyone.
  response.headers.set("Vary", "Cookie, Accept-Language");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Build output and image optimizer never need a redirect. Everything else does, service worker and icons included,
  // so nothing keeps being served from a shortcut domain.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
