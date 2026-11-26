import { type Browser, type CDPSession, type Page, expect, test } from "@playwright/test";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { skipTutorials } from "../shared";

/**
 * Profiles and accounts, against the real server and the test schema of the
 * database. The passkeys are real WebAuthn ceremonies: Chromium's virtual
 * authenticator stands in for a password manager, and "the same passkey on
 * another device" is its credential copied into a second browser, which is
 * what a synced passkey is.
 *
 * Without a database the feature is off and these tests skip themselves.
 */
test.beforeEach(async ({ request }) => {
  const session = await request.get("/api/session");
  test.skip(session.status() === 503, "the site runs without a database");
});

type Authenticator = { client: CDPSession; id: string };
type Credential = { credentialId: string; isResidentCredential: boolean; rpId?: string; privateKey: string; userHandle?: string; signCount: number };

/** Gives the page an authenticator that approves every request by itself, like a phone that is always unlocked. */
async function authenticator(page: Page): Promise<Authenticator> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { client, id: authenticatorId };
}

const credentialsOf = async (device: Authenticator): Promise<Credential[]> => (await device.client.send("WebAuthn.getCredentials", { authenticatorId: device.id })).credentials as Credential[];

/** A second device: its own cookies, its own storage, its own authenticator. */
async function device(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await skipTutorials(page);
  return page;
}

const score = (game: string, elapsedMs: number) => ({ game, date: pacificDateKey(new Date()), number: 1, difficulty: "medium", size: 6, elapsedMs, hintsUsed: 0, mistakes: 0 });

/** A nickname no other test can have picked. */
const nickname = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

async function openProfile(page: Page): Promise<void> {
  await page.goto("/profile");
  await expect(page.getByTestId("profile")).toHaveAttribute("data-ready", "true");
}

test("a device player becomes an account with a passkey, and a second device signs in and brings its scores", async ({ page, browser }) => {
  await skipTutorials(page);
  const phoneKey = await authenticator(page);

  // The phone has played: it has a player, known only to this browser.
  const zip = (await (await page.request.post("/api/scores", { data: score("zip", 60_000) })).json()) as { points: number };
  await openProfile(page);
  await expect(page.getByTestId("account-kind")).toHaveText("this device only");
  await expect(page.getByTestId("account-card")).toContainText("This player lives on this device");

  // It picks a name and a nickname, then makes the account. The passkey is created by the authenticator, and nothing is typed.
  const nick = nickname("ana");
  await page.getByTestId("profile-name").fill("Ana");
  await page.getByTestId("profile-nickname").fill(nick);
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-save")).toHaveText("Saved");
  await page.getByTestId("account-create").click();
  await expect(page.getByTestId("account-notice")).toHaveAttribute("data-kind", "created");
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  await expect(page.getByTestId("account-kind")).toHaveText("account");
  await expect(page.getByTestId("passkey")).toHaveCount(1);
  // One passkey cannot be removed: it is the only way back in.
  await expect(page.getByTestId("passkey-remove")).toHaveCount(0);
  const [credential] = await credentialsOf(phoneKey);
  expect(credential.isResidentCredential).toBe(true);

  // The computer has played too, as a player of its own. It solved Queens, and Zip later than the phone did.
  const computer = await device(browser);
  const computerKey = await authenticator(computer);
  await computer.request.post("/api/scores", { data: score("zip", 5_000) });
  const queens = (await (await computer.request.post("/api/scores", { data: score("queens", 60_000) })).json()) as { points: number };
  // It also opened a challenge room.
  const room = ((await (await computer.request.post("/api/rooms", { data: { rounds: [{ game: "zip", difficulty: "easy" }] } })).json()) as { room: { code: string } }).room;
  await openProfile(computer);
  await expect(computer.getByTestId("account-kind")).toHaveText("this device only");
  await expect(computer.getByTestId("profile-name")).not.toHaveValue("Ana");

  // The password manager syncs the passkey to the computer, and the computer signs in with it.
  await computerKey.client.send("WebAuthn.addCredential", { authenticatorId: computerKey.id, credential });
  await computer.getByTestId("account-sign-in").click();
  await expect(computer.getByTestId("account-notice")).toHaveAttribute("data-kind", "signedIn");
  await expect(computer.getByTestId("profile")).toHaveAttribute("data-account", "true");
  await expect(computer.getByTestId("profile-name")).toHaveValue("Ana");
  await expect(computer.getByTestId("profile-nickname")).toHaveValue(nick);

  // The computer's own player is not swallowed without a word: its scores are offered, and join the account when asked.
  const offer = computer.getByTestId("account-merge");
  await expect(offer).toContainText("2 puzzles");
  await computer.getByTestId("account-merge-button").click();
  await expect(computer.getByTestId("account-notice")).toHaveAttribute("data-kind", "merged");
  await expect(offer).toHaveCount(0);

  // One player now, on both devices, with the scores of both. For Zip, which both solved, the phone's earlier solve is the one that counts.
  const me = ((await (await computer.request.get("/api/session")).json()) as { player: { id: string; nickname: string; account: boolean } }).player;
  expect(me).toMatchObject({ nickname: nick, account: true });
  expect(((await (await page.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(me.id);
  const ranking = ((await (await computer.request.get("/api/ranking?period=all&game=all")).json()) as { ranking: { entries: { id: string; points: number; solved: number }[]; you: { points: number; solved: number } | null } }).ranking;
  const mine = ranking.entries.find((entry) => entry.id === me.id) ?? ranking.you;
  expect(mine).toMatchObject({ solved: 2, points: zip.points + queens.points });
  // The room the computer's player opened is the account's now.
  const moved = ((await (await page.request.get(`/api/rooms/${room.code}`)).json()) as { room: { hostId: string; you: string | null; players: { id: string }[] } }).room;
  expect(moved).toMatchObject({ hostId: me.id, you: me.id });
  expect(moved.players.map((player) => player.id)).toEqual([me.id]);
  await computer.goto("/ranking");
  await expect(computer.getByTestId("ranking-row").filter({ hasText: "you" }).getByTestId("ranking-nickname")).toHaveText(`@${nick}`);

  // Signing out leaves the computer without a player: its old one became part of the account. The phone is untouched.
  await openProfile(computer);
  await computer.getByTestId("account-sign-out").click();
  await expect(computer.getByTestId("profile")).toHaveAttribute("data-account", "false");
  expect(((await (await computer.request.get("/api/session")).json()) as { player: unknown }).player).toBeNull();
  await openProfile(page);
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  await expect(page.getByTestId("passkey")).toContainText(/used on/);
  await computer.context().close();
});

test("signing in on a device with nothing to bring just switches to the account, and signing out gives the device its player back", async ({ page, browser }) => {
  await skipTutorials(page);
  const key = await authenticator(page);
  await page.request.post("/api/scores", { data: score("zip", 60_000) });
  await openProfile(page);
  await page.getByTestId("account-create").click();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  const [credential] = await credentialsOf(key);
  const account = ((await (await page.request.get("/api/session")).json()) as { player: { id: string } }).player;

  // A friend's computer: it has a player with a name, and no scores.
  const other = await device(browser);
  const otherKey = await authenticator(other);
  const friend = ((await (await other.request.post("/api/session", { data: { name: "Friend" } })).json()) as { player: { id: string } }).player;
  await otherKey.client.send("WebAuthn.addCredential", { authenticatorId: otherKey.id, credential });
  await openProfile(other);
  await other.getByTestId("account-sign-in").click();
  await expect(other.getByTestId("profile")).toHaveAttribute("data-account", "true");
  await expect(other.getByTestId("account-merge")).toHaveCount(0);
  expect(((await (await other.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(account.id);

  // The session cookie is as closed to scripts as the device's own.
  const cookies = await other.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "play_session")).toMatchObject({ httpOnly: true, sameSite: "Lax" });

  await other.getByTestId("account-sign-out").click();
  await expect(other.getByTestId("profile")).toHaveAttribute("data-account", "false");
  expect(((await (await other.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(friend.id);
  await expect(other.getByTestId("profile-name")).toHaveValue("Friend");
  await other.context().close();
});

test("a nickname belongs to one player", async ({ page, browser }) => {
  await skipTutorials(page);
  const nick = nickname("only");
  await openProfile(page);
  // A device with no player yet sees a suggestion. Saving creates the player.
  await expect(page.getByTestId("profile-name")).toHaveValue(/^\w+ \d{3}$/);
  await page.getByTestId("profile-nickname").fill(`@${nick.toUpperCase()}`);
  // Typed as it is stored: lower case, without the "@".
  await expect(page.getByTestId("profile-nickname")).toHaveValue(nick);
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-save")).toHaveText("Saved");

  const other = await device(browser);
  await openProfile(other);
  await other.getByTestId("profile-nickname").fill(nick);
  await other.getByTestId("profile-save").click();
  await expect(other.getByTestId("profile-error")).toHaveText("Another player has this nickname.");
  // What cannot be a nickname is refused before it is sent.
  await other.getByTestId("profile-nickname").fill("no spaces");
  await expect(other.getByTestId("profile-error")).toContainText("3 to 20 lower case letters");
  await expect(other.getByTestId("profile-save")).toBeDisabled();
  // The display name is free: two players may share it, and the nickname tells them apart.
  await other.getByTestId("profile-nickname").fill(nickname("other"));
  await other.getByTestId("profile-name").fill("Same Name");
  await other.getByTestId("profile-save").click();
  await expect(other.getByTestId("profile-save")).toHaveText("Saved");
  await page.getByTestId("profile-name").fill("Same Name");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-save")).toHaveText("Saved");
  // The server holds the line too, whatever the page checks.
  expect((await other.request.patch("/api/session", { data: { nickname: nick } })).status()).toBe(409);
  expect((await other.request.patch("/api/session", { data: { nickname: "admin" } })).status()).toBe(400);
  await other.context().close();
});

test("deleting a player removes it and its scores, and its passkey opens nothing afterwards", async ({ page, browser }) => {
  await skipTutorials(page);
  const key = await authenticator(page);
  await page.request.post("/api/scores", { data: score("zip", 60_000) });
  const me = ((await (await page.request.get("/api/session")).json()) as { player: { id: string } }).player;
  await openProfile(page);
  await page.getByTestId("account-create").click();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  const [credential] = await credentialsOf(key);
  // The last passkey stays, even when asked for directly.
  expect((await page.request.delete(`/api/account/passkeys/${credential.credentialId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`)).status()).toBe(409);

  await page.getByTestId("account-delete").click();
  await expect(page.getByTestId("account-delete-confirm")).toContainText("removed from the server for good");
  await page.getByTestId("account-delete-confirm").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "false");
  expect(((await (await page.request.get("/api/session")).json()) as { player: unknown }).player).toBeNull();
  const ranking = ((await (await page.request.get("/api/ranking?period=all&game=all")).json()) as { ranking: { entries: { id: string }[] } }).ranking;
  expect(ranking.entries.some((entry) => entry.id === me.id)).toBe(false);

  // The password manager still has the passkey. It no longer belongs to anyone here.
  const other = await device(browser);
  const otherKey = await authenticator(other);
  await otherKey.client.send("WebAuthn.addCredential", { authenticatorId: otherKey.id, credential });
  await openProfile(other);
  await other.getByTestId("account-sign-in").click();
  await expect(other.getByTestId("account-notice")).toHaveAttribute("data-kind", "unknownPasskey");
  await expect(other.getByTestId("profile")).toHaveAttribute("data-account", "false");
  await other.context().close();
});

test("passkeys are only offered to the site's own pages", async ({ request }) => {
  // No Origin header, as from a script or another site's server: there is no relying party to name.
  expect((await request.post("/api/account/login", { data: { action: "options" }, headers: { origin: "https://evil.example" } })).status()).toBe(400);
  // A verification with no ceremony behind it has no challenge to answer.
  const origin = new URL((await request.get("/api/session")).url()).origin;
  expect((await request.post("/api/account/login", { data: { action: "verify", response: { id: "nope" } }, headers: { origin } })).status()).toBe(400);
});

test("the profile page reads in Portuguese", async ({ page }) => {
  await skipTutorials(page);
  await page.goto("/pt-br/profile");
  await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("account-kind")).toHaveText("só neste dispositivo");
  await expect(page.getByTestId("account-create")).toHaveText("Criar conta");
  await expect(page.getByTestId("account-sign-in")).toHaveText("Entrar com passkey");
});
