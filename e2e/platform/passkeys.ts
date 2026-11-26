import { type Browser, type CDPSession, type Page, expect } from "@playwright/test";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { skipTutorials } from "../shared";

/**
 * Passkeys for the tests. Chromium's virtual authenticator stands in for a
 * password manager and approves every request by itself, like a phone that is
 * always unlocked. "The same passkey on another device" is its credential
 * copied into a second browser, which is what a synced passkey is.
 */
export type Authenticator = { client: CDPSession; id: string };
export type Credential = { credentialId: string; isResidentCredential: boolean; rpId?: string; privateKey: string; userHandle?: string; signCount: number };

export async function authenticator(page: Page): Promise<Authenticator> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { client, id: authenticatorId };
}

export const credentialsOf = async (device: Authenticator): Promise<Credential[]> => (await device.client.send("WebAuthn.getCredentials", { authenticatorId: device.id })).credentials as Credential[];

/** A second device: its own cookies, its own storage. */
export async function device(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await skipTutorials(page);
  return page;
}

export async function openProfile(page: Page): Promise<void> {
  await page.goto("/profile");
  await expect(page.getByTestId("profile")).toHaveAttribute("data-ready", "true");
}

/** Turns the page's player into an account and returns the passkey that opens it. */
export async function createAccount(page: Page): Promise<Credential> {
  const key = await authenticator(page);
  await openProfile(page);
  await page.getByTestId("account-create").click();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  return (await credentialsOf(key))[0];
}

/** Signs a device in to the account of a passkey, as a password manager that synced it would let it. */
export async function signIn(page: Page, credential: Credential): Promise<void> {
  const key = await authenticator(page);
  await key.client.send("WebAuthn.addCredential", { authenticatorId: key.id, credential });
  await openProfile(page);
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
}

/** A daily score as a device reports it. The date is today's, on the calendar of the daily puzzles. */
export const score = (game: string, elapsedMs: number, more: Record<string, unknown> = {}) => ({ game, date: pacificDateKey(new Date()), number: 1, difficulty: "medium", size: 6, elapsedMs, hintsUsed: 0, mistakes: 0, ...more });
