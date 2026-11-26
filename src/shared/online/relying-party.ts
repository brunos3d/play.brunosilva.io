import { SITE_ORIGIN } from "@/shared/platform/site";

/**
 * Who a passkey belongs to, from the browser's point of view. A passkey is
 * bound to a domain (the relying party id), and the browser refuses to use it
 * anywhere else, which is what makes it immune to phishing. The server has to
 * name the same domain when it checks a signature.
 */
export type RelyingParty = { origin: string; rpID: string };

/**
 * The relying party of a request, or null for a request passkeys are not
 * offered to. The page and the API must share an origin, and the origin must
 * be the site's own address, a preview deployment, or a local server.
 *
 * A passkey made on one of these does not work on another: one made on a
 * preview deployment stays there, and production has its own.
 */
export function relyingPartyFor(origin: string | null | undefined, host: string | null | undefined): RelyingParty | null {
  if (!origin || !host) return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  // The request came from another site's page. A browser would not let its passkeys be used for it anyway.
  if (url.host !== host.trim().toLowerCase()) return null;
  const local = url.hostname === "localhost";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  if (!local && url.hostname !== new URL(SITE_ORIGIN).hostname && !url.hostname.endsWith(".vercel.app")) return null;
  return { origin: url.origin, rpID: url.hostname };
}
