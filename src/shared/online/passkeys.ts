import { WebAuthnError, browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { OnlineError, type PlayerHint, online } from "./api";
import type { Account } from "./types";

/**
 * The browser's side of a passkey: asks the server for a challenge, hands it
 * to the authenticator (the password manager, the phone, a security key),
 * and sends the answer back. The dialogs the player sees are the browser's
 * own, so nothing here knows or cares which authenticator answers.
 */

/** Why a ceremony did not finish, as a key of the "online.account.errors" messages. */
export type PasskeyProblem = "cancelled" | "unsupported" | "exists" | "unknownPasskey" | "refused" | "tooMany" | "offline" | "failed";

export const passkeysSupported = (): boolean => typeof window !== "undefined" && browserSupportsWebAuthn();

function problemOf(error: unknown): PasskeyProblem {
  if (error instanceof WebAuthnError) {
    // The authenticator already holds a passkey of this account.
    if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "exists";
    // Closing the browser's dialog, or letting it time out, is not an error worth alarming anyone about.
    if (error.name === "NotAllowedError" || error.name === "AbortError") return "cancelled";
    return "failed";
  }
  if (error instanceof OnlineError) {
    if (error.code === "offline") return "offline";
    if (error.code === "unknown-passkey") return "unknownPasskey";
    if (error.code === "passkey-exists") return "exists";
    if (error.code === "too-many-passkeys") return "tooMany";
    if (error.code === "passkey-refused" || error.code === "no-challenge") return "refused";
    return "failed";
  }
  // A dialog dismissed in a browser that reports it as a plain DOMException.
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) return "cancelled";
  return "failed";
}

export class PasskeyFailure extends Error {
  constructor(readonly problem: PasskeyProblem) {
    super(problem);
  }
}

async function ceremony<T>(run: () => Promise<T>): Promise<T> {
  if (!passkeysSupported()) throw new PasskeyFailure("unsupported");
  try {
    return await run();
  } catch (error) {
    throw new PasskeyFailure(problemOf(error));
  }
}

/**
 * A name for a new passkey, so its owner can tell two of them apart later:
 * the browser and the system it was made on, as far as the browser says.
 * "Chrome, Android". It describes where the passkey was made, not where it is kept.
 */
export function passkeyLabel(): string {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "";
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad|iPod/.test(agent) ? "iOS" : /Mac OS X/.test(agent) ? "macOS" : /Windows/.test(agent) ? "Windows" : /CrOS/.test(agent) ? "ChromeOS" : /Linux/.test(agent) ? "Linux" : "";
  return [browser, system].filter(Boolean).join(", ");
}

/** Adds a passkey to this device's player, creating the player first when the device has none. The player is an account from then on. */
export function createPasskey(hint: PlayerHint = {}): Promise<Account> {
  return ceremony(async () => {
    const optionsJSON = (await online.passkeyOptions(hint)) as PublicKeyCredentialCreationOptionsJSON;
    const response = await startRegistration({ optionsJSON });
    return online.passkeyVerify(response, passkeyLabel());
  });
}

/** Signs this device in to the account of whichever passkey the player picks. */
export function signInWithPasskey(): Promise<Account> {
  return ceremony(async () => {
    const optionsJSON = (await online.loginOptions()) as PublicKeyCredentialRequestOptionsJSON;
    const response = await startAuthentication({ optionsJSON });
    return online.loginVerify(response);
  });
}
