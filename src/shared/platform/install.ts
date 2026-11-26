"use client";

import { useSyncExternalStore } from "react";

/**
 * Installing the site as an app. It is already a PWA: a manifest, icons and a
 * service worker that keeps the games playable offline. What is missing on a
 * phone is the invitation, because the browser's own is easy to miss or, on
 * iOS, does not exist.
 *
 * - Chrome, Edge and Samsung Internet on Android fire `beforeinstallprompt`
 *   when a site can be installed. The event is kept here, and its `prompt()`
 *   opens the browser's install dialog when the player asks for it.
 * - Safari and every other browser on iOS and iPadOS have no such event. The
 *   only way in is Share, then "Add to Home Screen", so the banner says that.
 *
 * Anywhere else, and in a copy that is already installed, nothing is offered.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type InstallState =
  /** Not a phone or tablet, already installed, or a browser that cannot install. */
  | { kind: "none" }
  /** The browser can install on request. */
  | { kind: "prompt" }
  /** iOS: the player has to do it from the Share menu. */
  | { kind: "ios" };

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const NONE: InstallState = { kind: "none" };
const PROMPT: InstallState = { kind: "prompt" };
const IOS: InstallState = { kind: "ios" };

const notify = () => {
  for (const listener of listeners) listener();
};

// The event can fire before any component has mounted, so it is caught as soon as this module loads.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // The browser's own small banner stays out of the way: the site shows its own, in its own words and language.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** True when the page runs as an installed app, from the home screen. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone, iPod and iPad. An iPad says it is a Mac, and gives itself away by having a touch screen. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** A phone or a tablet, by what the browser says it is. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const hinted = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  return hinted === true || isIos() || /Android/i.test(navigator.userAgent);
}

/**
 * A device used by touch: more than one touch point, a coarse pointer and no
 * hover. An Android tablet asking for the desktop site says it is a Linux
 * computer in every other way. A laptop with a touch screen has a mouse
 * pointer and hovers, and is not one.
 */
function isTouchFirst(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.maxTouchPoints > 1 && window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(hover: hover)").matches;
}

/**
 * A page opened inside another app (Instagram, Facebook, TikTok and the
 * like). Those web views have no "Add to Home Screen", so pointing at the
 * Share menu there would send the player looking for something that is not in it.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|LinkedInApp|Twitter|Snapchat|Pinterest|GSA\//i.test(navigator.userAgent);
}

function read(): InstallState {
  if (installed || isStandalone()) return NONE;
  // The browser said the site can be installed. On a phone, a tablet, or anything used by touch, the offer is made.
  if (deferred && (isMobileDevice() || isTouchFirst())) return PROMPT;
  return isMobileDevice() && isIos() && !isInAppBrowser() ? IOS : NONE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How this device can install the site, if it can. "none" on the server and until the page has hydrated. */
export function useInstall(): InstallState {
  return useSyncExternalStore(subscribe, read, () => NONE);
}

/** Opens the browser's install dialog. Resolves true when the player accepted. The event can be used once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  notify();
  try {
    await event.prompt();
    return (await event.userChoice).outcome === "accepted";
  } catch {
    return false;
  }
}
