"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";

/**
 * The notice a first visit gets: what the site keeps in the browser, with the
 * way to the privacy policy and the terms. It has one button. Everything the
 * site stores is needed for a feature the visitor asks for, so there is
 * nothing to refuse piece by piece, and the policy says how to block cookies
 * altogether.
 *
 * The answer lives in local storage, like the settings. The banner is not a
 * dialog: the page under it stays usable.
 */
export const CONSENT_STORAGE_KEY = "minigames:consent:v1";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function accepted(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) !== null;
  } catch {
    // Storage is blocked. The answer could not be kept, so the banner would come back on every page: better not to show it.
    return true;
  }
}

function accept(): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ accepted: new Date().toISOString() }));
  } catch {
    // Nothing to do: see above.
  }
  for (const listener of listeners) listener();
}

/** True once the notice has been answered. False on the server and until the page has hydrated, so nothing that waits for the answer shows early. */
export function useConsentAnswered(): boolean {
  return useSyncExternalStore(subscribe, accepted, () => false);
}

export function ConsentBanner() {
  const t = useTranslations("common.consent");
  // The server and the first client render say "accepted", so the banner never flashes for someone who has answered.
  const hidden = useSyncExternalStore(subscribe, accepted, () => true);
  if (hidden) return null;
  return (
    <aside className="mg-consent" aria-label={t("label")} data-testid="consent">
      <p>
        {t("text")}{" "}
        {t.rich("more", {
          privacy: (chunks) => (
            <Link href="/privacy" prefetch={false} className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
          terms: (chunks) => (
            <Link href="/terms" prefetch={false} className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <button type="button" className="mg-button" data-variant="primary" onClick={accept} data-testid="consent-accept">
        {t("accept")}
      </button>
    </aside>
  );
}
