import { type NextRequest, NextResponse } from "next/server";
import { resolveHostRedirect } from "@/shared/platform/site";

/**
 * The platform lives at play.brunosilva.io. The shortcut domains
 * zip.brunosilva.io and patches.brunosilva.io open their game there. The rule
 * itself is in shared/platform/site.ts, where it is unit tested.
 *
 * 308 keeps the method and tells browsers and search engines the move is
 * permanent. Browsers cache it hard, so switch to 307 while experimenting with
 * the domains.
 */
const REDIRECT_STATUS = 308;

export function proxy(request: NextRequest) {
  // Behind Vercel's edge the public host arrives in x-forwarded-host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const target = resolveHostRedirect(host, request.nextUrl.pathname, request.nextUrl.search);
  return target ? NextResponse.redirect(target, REDIRECT_STATUS) : NextResponse.next();
}

export const config = {
  // Build output and image optimizer never need a redirect. Everything else does, service worker and icons included,
  // so nothing keeps being served from a shortcut domain.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
