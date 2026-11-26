import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Headers every response carries. None of them changes what the site does for
 * a visitor. Each one takes a tool away from someone else's page:
 *
 * - no other site may show this one inside a frame, which is how a click
 *   meant for a button there is turned into a click on "Delete" here;
 * - a file is what its type says it is, never guessed;
 * - a link out of the site says where the visitor came from, and not which
 *   room or seed they were on;
 * - the browser features the site has no use for are off, for the site and
 *   for anything it might one day embed. Passkeys stay on for the site itself;
 * - a browser that has seen the site over https never tries plain http again.
 *
 * The policy has no script rule. The pages carry inline scripts (the theme,
 * and the framework's own), so one that helps would need a nonce on every
 * request, and every page would stop being static. What is here costs nothing.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), publickey-credentials-get=(self), publickey-credentials-create=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // The browser tests build into a folder of their own (see playwright.config.ts), so a test run never replaces the files a running `next dev` serves from `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
