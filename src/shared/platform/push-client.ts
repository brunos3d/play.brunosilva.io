"use client";

import { useSyncExternalStore } from "react";
import { isIos, isStandalone } from "./install";

/**
 * The browser's side of streak reminders: asking for permission, subscribing
 * with the server's key, and telling the server about it. See src/server/push.ts
 * for what the server does with a subscription.
 */
export type PushState =
  /** The browser cannot do it, the site has no keys, or iOS is not running the installed app, which is the only place it allows push. */
  | "unsupported"
  /** The player said no to notifications in the browser. Only the browser's own settings can undo that. */
  | "blocked"
  | "off"
  | "on";

/** What turning reminders on ends in. "failed" is a request that did not go through: nothing changed, and trying again makes sense. */
export type EnableResult = PushState | "failed";

// Where reminders stand, shared by everything on the page that shows it: the switch in the settings and the offer on
// the home screen must never disagree.
let current: PushState | null = null;
const listeners = new Set<() => void>();
/** The server's key, once it has been read. With it, turning reminders on can ask for permission before any request. */
let knownKey: string | null = null;

function settle(state: PushState): PushState {
  if (current !== state) {
    current = state;
    for (const listener of listeners) listener();
  }
  return state;
}

function listen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Where reminders stand on this device, or null until `readPushState` has found out. */
export function usePushState(): PushState | null {
  return useSyncExternalStore(
    listen,
    () => current,
    () => null,
  );
}

type Answer = { key: string | null; subscribed: boolean };

/**
 * The server's key, and whether an endpoint is subscribed for the current
 * player. The endpoint goes in a body, never in the address. Null when the
 * request did not go through, which is not the same as a site without keys.
 */
async function ask(endpoint?: string): Promise<Answer | null> {
  const response = endpoint
    ? await fetch("/api/push", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", endpoint }) })
    : await fetch("/api/push", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return null;
  const answer = (await response.json()) as Partial<Answer>;
  knownKey = answer.key ?? null;
  return { key: knownKey, subscribed: answer.subscribed === true };
}

function capable(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  // On iOS the Push API exists only inside the installed app.
  return !isIos() || isStandalone();
}

const timeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function send(subscription: PushSubscription, locale: string): Promise<Response> {
  return fetch("/api/push", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON(), locale, timezone: timeZone() }) });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Where reminders stand on this device for the current player. When the
 * server cannot be asked (offline, or it is failing), what was known stays as
 * it was: a request that did not go through says nothing about the device.
 */
export async function readPushState(): Promise<PushState> {
  if (!capable()) return settle("unsupported");
  if (Notification.permission === "denied") return settle("blocked");
  let subscription: PushSubscription | null;
  try {
    subscription = await currentSubscription();
  } catch {
    return settle("unsupported");
  }
  const answer = await ask(subscription?.endpoint).catch(() => null);
  if (!answer) return current ?? "unsupported";
  if (!answer.key) return settle("unsupported");
  return settle(subscription && answer.subscribed && Notification.permission === "granted" ? "on" : "off");
}

/** The key the server signs with, as the bytes `pushManager.subscribe` wants. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = `${key}${"=".repeat((4 - (key.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** How long to wait for the service worker to be ready before giving up on subscribing. */
const WORKER_READY_MS = 5_000;

/** The worker's registration once it is active, or null when there is none or it does not come up in time. */
async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  // Without a registration `navigator.serviceWorker.ready` never settles, and whoever waits on it waits for good.
  if (!(await navigator.serviceWorker.getRegistration())) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => window.setTimeout(() => resolve(null), WORKER_READY_MS))]);
}

/**
 * Asks the browser for permission to notify. "granted" when it may, and
 * otherwise the state reminders are left in, or "failed" when the server could
 * not be asked for its key.
 *
 * The prompt has to be an answer to a tap, and a browser stops counting a tap
 * as one after a moment. So nothing slow comes before it. The key is known by
 * then: nothing offers reminders before `readPushState` has read it. Whoever
 * has more to do first (creating a player, say) calls this before doing it.
 */
export async function requestPushPermission(): Promise<"granted" | EnableResult> {
  if (!capable()) return settle("unsupported");
  try {
    if (!knownKey) {
      const answer = await ask();
      if (!answer) return "failed";
      if (!answer.key) return settle("unsupported");
    }
    if (Notification.permission !== "granted") await Notification.requestPermission();
    // The browser's own word, not the prompt's answer: a prompt the browser declined to show is not a "no" from the player.
    if (Notification.permission !== "granted") return settle(Notification.permission === "denied" ? "blocked" : "off");
    return "granted";
  } catch {
    return "failed";
  }
}

/**
 * Turns reminders on: asks the browser for permission, subscribes, and stores
 * the subscription with the server. Resolves with the state it ends in.
 */
export async function enablePush(locale: string): Promise<EnableResult> {
  const allowed = await requestPushPermission();
  if (allowed !== "granted") return allowed;
  try {
    const key = knownKey;
    const registration = await activeRegistration();
    if (!key || !registration) return "failed";
    const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    return (await send(subscription, locale)).ok ? settle("on") : "failed";
  } catch {
    return "failed";
  }
}

/** Tells the server to forget a subscription. True when the server answered that it has. */
const forget = (subscription: PushSubscription): Promise<boolean> =>
  fetch("/api/push", {
    method: "DELETE",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint, auth: subscription.toJSON().keys?.auth }),
  }).then(
    (response) => response.ok,
    () => false,
  );

/**
 * Turns reminders off on this device, here and on the server. Here comes
 * first, and does not wait for the server: offline, the browser still drops
 * the subscription, the push service then tells the server it is gone, and
 * the switch tells the truth either way.
 */
export async function disablePush(): Promise<PushState> {
  let subscribed = false;
  try {
    const subscription = await currentSubscription();
    if (subscription) {
      subscribed = true;
      const gone = await subscription.unsubscribe();
      await forget(subscription);
      if (!gone) return settle("on");
    }
  } catch {
    if (subscribed) return settle("on");
  }
  return settle(capable() ? "off" : "unsupported");
}

/**
 * Tells the server to stop reminding this device for the player it is
 * signed in as, and leaves the browser's subscription alone. Called before
 * signing out: the reminders were about that player's streak, and a device
 * that is signed out of an account must not keep hearing about it. The
 * subscription stays for whoever uses the device next (`refreshPush`).
 */
export async function releasePush(): Promise<void> {
  if (!capable()) return;
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    if ((await forget(subscription)) && current === "on") settle("off");
  } catch {
    // Signing out goes on. What this could not do, `refreshPush` does once the device has no player.
  }
}

/**
 * Tells the server what language and time zone the device is in now, and
 * which player it is. A device that has a subscription calls it when the app
 * opens, and after signing in or out, so a reminder follows a change of
 * language, a trip, or the player.
 *
 * A device with no player at all (it signed out of an account, or its session
 * ended) has nobody to be reminded for. Its subscription is dropped, on the
 * server and in the browser: whoever plays here next is asked, and is not
 * subscribed behind their back by a permission someone else gave.
 */
export async function refreshPush(locale: string): Promise<void> {
  if (!capable() || Notification.permission !== "granted") return;
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    const response = await send(subscription, locale);
    if (response.ok) {
      if (current === "off") settle("on");
    } else if (response.status === 401) {
      // The one 401 of this route: no player. Any other failure says nothing, and changes nothing.
      await forget(subscription);
      await subscription.unsubscribe();
      if (current === "on") settle("off");
    }
  } catch {
    // The next visit tries again.
  }
}
