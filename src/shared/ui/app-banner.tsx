"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PLATFORM_NAME } from "@/games/registry";
import { usePlayer } from "@/shared/online/use-player";
import { promptInstall, useInstall } from "@/shared/platform/install";
import { enablePush, readPushState, usePushState } from "@/shared/platform/push-client";
import { useConsentAnswered } from "./consent-banner";
import { PlatformIcon } from "./game-icons";
import { ShareIcon } from "./icons";

/**
 * The two invitations of the home screen, one at a time and never on top of
 * the cookie notice:
 *
 * - on a phone or tablet that can install the site, to install it;
 * - for a player with a streak, on a device that can be notified, to be
 *   reminded before the streak ends.
 *
 * "Not now" is remembered for a month. Both can be found again in the
 * settings at any time.
 */
export const OFFERS_STORAGE_KEY = "minigames:offers:v1";
const ASK_AGAIN_MS = 30 * 24 * 60 * 60 * 1000;

type Offer = "install" | "reminders";
type Declined = Partial<Record<Offer, string>>;

const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Declined } | null = null;

/**
 * What `declined` answers when the browser will not store anything. An offer
 * that cannot remember "not now" would come back on every page, so none is
 * made. The settings still have both.
 */
const BLOCKED: Declined = Object.freeze({});
let blocked = false;

function declined(): Declined {
  if (blocked) return BLOCKED;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OFFERS_STORAGE_KEY);
  } catch {
    blocked = true;
    return BLOCKED;
  }
  if (cached && cached.raw === raw) return cached.value;
  let value: Declined = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null) value = parsed as Declined;
  } catch {
    // Not what this module wrote. Treated as empty.
  }
  cached = { raw, value };
  return value;
}

const NOTHING: Declined = {};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function decline(offer: Offer): void {
  const next = { ...declined(), [offer]: new Date().toISOString() };
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(OFFERS_STORAGE_KEY, raw);
    cached = { raw, value: next };
  } catch {
    // The answer cannot be kept, so from here on nothing is offered.
    blocked = true;
  }
  for (const listener of listeners) listener();
}

const stillDeclined = (when: string | undefined, now: number): boolean => when !== undefined && now - Date.parse(when) < ASK_AGAIN_MS;

export function AppBanner() {
  const t = useTranslations("common");
  const locale = useLocale();
  const answered = useConsentAnswered();
  const install = useInstall();
  const { me } = usePlayer();
  const refused = useSyncExternalStore(subscribe, declined, () => NOTHING);
  // Shared with the switch in the settings: turned on there, the offer here goes away.
  const push = usePushState();
  const [busy, setBusy] = useState(false);
  // "Now" for the month a refusal lasts. Read once after mount: a render must not read the clock.
  const [now, setNow] = useState<number | null>(null);

  const streak = me?.streak ?? 0;
  useEffect(() => {
    const start = window.setTimeout(() => setNow(Date.now()), 0);
    // Only a player with a streak is asked about reminders, so only then is it worth finding out where they stand.
    if (streak > 0) void readPushState();
    return () => window.clearTimeout(start);
  }, [streak]);

  if (!answered || now === null || refused === BLOCKED) return null;
  const offer: Offer | null = install.kind !== "none" && !stillDeclined(refused.install, now) ? "install" : streak > 0 && push === "off" && !stillDeclined(refused.reminders, now) ? "reminders" : null;
  if (!offer) return null;

  const accept = async () => {
    setBusy(true);
    if (offer === "install") {
      // Accepted or not, the browser has asked: the banner has done its part for now.
      await promptInstall();
      decline("install");
    } else {
      const state = await enablePush(locale);
      // A "no" in the browser's prompt is an answer, and is not asked again for a month. A request that failed is not
      // one: the offer stays, to be tried again.
      if (state !== "on" && state !== "failed") decline("reminders");
    }
    setBusy(false);
  };
  const title = t(`offers.${offer}.title`, { app: PLATFORM_NAME, count: streak });

  return (
    <aside className="mg-consent" aria-label={title} data-testid="app-banner" data-offer={offer} data-kind={offer === "install" ? install.kind : undefined}>
      <div className="flex items-start gap-3 flex-[1_1_260px] min-w-0">
        <PlatformIcon className="w-10 h-10 flex-none rounded-[10px] shadow-[0_0_0_1.5px_var(--thread)]" />
        <div className="min-w-0">
          <p className="font-semibold text-[15px] leading-snug">{title}</p>
          {offer === "install" && install.kind === "ios" ? (
            // iOS has no install dialog a site can open. The way in is the browser's own Share menu.
            <p className="text-[var(--ink-soft)]">
              {t.rich("offers.install.ios", {
                share: () => <ShareIcon className="inline-block w-4 h-4 align-[-3px] text-[var(--ink)]" />,
                strong: (chunks) => <strong className="font-semibold text-[var(--ink)]">{chunks}</strong>,
              })}
            </p>
          ) : (
            <p className="text-[var(--ink-soft)]">{t(`offers.${offer}.body`)}</p>
          )}
        </div>
      </div>
      <div className="mg-actions flex-[1_1_100%]">
        <button type="button" className="mg-button" onClick={() => decline(offer)} disabled={busy} data-testid="app-banner-later">
          {t(offer === "install" && install.kind === "ios" ? "offers.gotIt" : "offers.later")}
        </button>
        {!(offer === "install" && install.kind === "ios") && (
          <button type="button" className="mg-button" data-variant="primary" onClick={() => void accept()} disabled={busy} data-testid="app-banner-accept">
            {t(`offers.${offer}.accept`)}
          </button>
        )}
      </div>
    </aside>
  );
}
