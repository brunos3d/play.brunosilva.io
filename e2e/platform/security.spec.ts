import { type APIRequestContext, expect, test } from "@playwright/test";
import { pacificDateKey } from "@/shared/engine/pacific-time";
import { cleanAvatarSeed, cleanNickname, cleanPlayerName } from "@/shared/online/names";
import { skipTutorials } from "../shared";
import { SCHEMA, sql } from "./database";
import { authenticator, createAccount, device, openProfile, signIn } from "./passkeys";
import { PUSH_KEYS, pushEndpoint } from "./push";

/**
 * What a hostile client can and cannot do. Everything a browser sends reaches
 * the server as text a player controls: names, codes in the address, query
 * strings, JSON bodies, cookies. These tests send the classic attacks through
 * every one of those doors, against the real server and the test schema of
 * the database, and then look at the database itself to see that nothing but
 * the sender's own rows changed.
 *
 * Without a database the routes answer 503 and the tests skip themselves.
 */
test.beforeEach(async ({ request }) => {
  test.skip((await request.get("/api/session")).status() === 503, "the site runs without a database");
});
test.setTimeout(120_000);

/** Text that means something to a SQL parser, a JSON parser, a shell or Postgres itself. To a parameter it is just text. */
const HOSTILE = [
  "'",
  "''",
  '"',
  "\\",
  "' OR '1'='1",
  "' OR 1=1 --",
  "'; DROP TABLE players; --",
  `'; DROP TABLE "${SCHEMA}".players; --`,
  `"; DROP SCHEMA "${SCHEMA}" CASCADE; --`,
  "'); DELETE FROM daily_scores; --",
  "' UNION SELECT secret_hash, null FROM players --",
  "'; UPDATE players SET name = 'pwned'; --",
  "'; CREATE TABLE pwned (id int); --",
  "1; SELECT pg_sleep(8)",
  "' || pg_sleep(8) || '",
  "x' AND 1=(SELECT 1 FROM pg_sleep(8)) --",
  "$1",
  "$1; --",
  "${1}",
  "{{7*7}}",
  "%27%3B%20DROP%20TABLE%20players",
  "admin'/*",
  "*/ DROP TABLE players /*",
  "\u0000",
  "a\u0000b",
  "\ud800",
  "🙂'; --",
  "<script>alert(1)</script>",
  "../../../etc/passwd",
  "null",
  "true",
  "-1",
  "1e999",
  "99999999999999999999999999",
  "x".repeat(6000),
];

/** Values that are not text at all, for fields that expect text, a number or an object. */
const SHAPES: unknown[] = [null, true, 0, -1, 1.5, 1e308, [], [["'"]], {}, { $ne: null }, { toString: "x" }, { __proto__: { admin: true } }];

const today = () => pacificDateKey(new Date());
const score = (more: Record<string, unknown> = {}) => ({ game: "zip", date: today(), number: 1, difficulty: "medium", size: 6, elapsedMs: 60_000, hintsUsed: 0, mistakes: 0, ...more });

/** A value as part of an address. Half a surrogate pair has no encoding, so it goes as the bytes a careless client would send. */
function inAddress(text: string): string {
  try {
    return encodeURIComponent(text);
  } catch {
    return "%ED%A0%80";
  }
}

/** Fails on a server error, and on an answer slow enough to mean a `pg_sleep` ran. */
async function calm(what: string, send: () => Promise<{ status(): number }>): Promise<number> {
  const started = Date.now();
  const status = (await send()).status();
  expect(status, `${what}: the server answered ${status}`).toBeLessThan(500);
  expect(Date.now() - started, `${what}: took as long as an injected sleep`).toBeLessThan(6_000);
  return status;
}

/** The tables and columns of the test schema, as one sorted list. */
const shapeOfSchema = async (): Promise<string[]> =>
  (await sql<{ item: string }>("select table_name || '.' || column_name || ':' || data_type as item from information_schema.columns where table_schema = $1 order by 1", [SCHEMA])).map((row) => row.item);

type Canary = { id: string; request: APIRequestContext; row: () => Promise<unknown>; scores: () => Promise<unknown> };

/** A player who does nothing after being set up: what must still be there, unchanged, when the attacks are over. */
async function canary(playwright: { request: { newContext(options: { baseURL?: string }): Promise<APIRequestContext> } }, baseURL: string | undefined): Promise<Canary> {
  const request = await playwright.request.newContext({ baseURL });
  const id = ((await (await request.post("/api/session", { data: { name: "Canary" } })).json()) as { player: { id: string } }).player.id;
  await request.post("/api/scores", { data: score({ game: "queens" }) });
  return {
    id,
    request,
    row: async () => (await sql("select id, name, nickname, avatar, secret_hash, streak_current, streak_best from {schema}.players where id = $1", [id]))[0],
    scores: async () => sql("select game, variant, date::text, outcome, points, elapsed_ms from {schema}.daily_scores where player_id = $1 order by game", [id]),
  };
}

test("hostile text in every field is stored as text or refused, and the database is as it was", async ({ request, playwright, baseURL }) => {
  // Some two thousand requests.
  test.setTimeout(480_000);
  const bird = await canary(playwright, baseURL);
  const before = { shape: await shapeOfSchema(), row: await bird.row(), scores: await bird.scores() };
  expect(before.row).toBeTruthy();
  expect(before.scores).toHaveLength(1);

  const me = ((await (await request.post("/api/session", { data: { name: "Mallory" } })).json()) as { player: { id: string } }).player.id;
  const origin = new URL((await request.get("/api/session")).url()).origin;

  // A display name is free text, and the one field where a hostile value is kept. They go one at a time, so each can be
  // read back before the next replaces it.
  for (const text of HOSTILE) {
    const label = JSON.stringify(text).slice(0, 50);
    // Whatever is taken is stored exactly as the cleaning leaves it, character for character.
    const named = await calm(`name ${label}`, () => request.patch("/api/session", { data: { name: text } }));
    if (named === 200) {
      const [stored] = await sql<{ name: string }>("select name from {schema}.players where id = $1", [me]);
      expect(stored.name, `name ${label}`).toBe(cleanPlayerName(text));
    } else expect(cleanPlayerName(text), `name ${label} was refused`).toBeNull();

  }

  // Every other door, with every value. A few values at a time: the answers do not depend on one another.
  const attack = async (text: string) => {
    const label = JSON.stringify(text).slice(0, 50);
    const quoted = inAddress(text);

    // A nickname and an avatar seed have a fixed alphabet. A value outside it is refused. The few that happen to fit it
    // ("null", "true") are ordinary nicknames and seeds, taken or not.
    expect([400, ...(cleanNickname(text) ? [200, 409] : [])], `nickname ${label}`).toContain(await calm(`nickname ${label}`, () => request.patch("/api/session", { data: { nickname: text } })));
    expect(await calm(`avatar ${label}`, () => request.patch("/api/session", { data: { avatar: text } })), `avatar ${label}`).toBe(cleanAvatarSeed(text) ? 200 : 400);
    await calm(`locale ${label}`, () => request.post("/api/session", { data: { locale: text } }));

    // Rankings: every part of the query string.
    for (const query of [`period=${quoted}`, `game=${quoted}`, `variant=${quoted}`, `period=${quoted}&game=${quoted}&variant=${quoted}`, `period=week&game=zip&variant=${quoted}`]) {
      // An unknown value falls back to the default view. An address too long for the web server is turned away before it gets here.
      expect(query.length > 4000 ? [200, 414, 431] : [200], `ranking ${query.slice(0, 40)}`).toContain(await calm(`ranking ${query.slice(0, 40)}`, () => request.get(`/api/ranking?${query}`)));
    }

    // Closing a daily, and opening one: every field in turn.
    for (const field of ["game", "variant", "date", "difficulty", "number", "size", "elapsedMs", "hintsUsed", "mistakes", "moves"]) {
      await calm(`score.${field} ${label}`, () => request.post("/api/scores", { data: score({ game: "patches", [field]: text }) }));
    }
    await calm(`score.board ${label}`, () => request.post("/api/scores", { data: score({ game: "sumbreak", board: { finishedMs: 60_000, puzzleId: text, [text.slice(0, 40) || "k"]: text, list: [text, { deep: text }] } }) }));
    for (const field of ["game", "variant", "date", "hints"]) {
      await calm(`open.${field} ${label}`, () => request.post("/api/daily", { data: { game: "zip", date: today(), hints: 0, [field]: text } }));
    }

    // Rooms: the code in the address, the rounds, and what a player in a room can say.
    for (const field of ["game", "difficulty", "size", "lang"]) {
      await calm(`round.${field} ${label}`, () => request.post("/api/rooms", { data: { rounds: [{ game: "zip", difficulty: "easy", [field]: text }] } }));
    }
    await calm(`rooms.rematchOf ${label}`, () => request.post("/api/rooms", { data: { rounds: [{ game: "zip", difficulty: "easy" }], rematchOf: text } }));
    expect(await calm(`room code ${label}`, () => request.get(`/api/rooms/${quoted || "%20"}`))).toBeGreaterThanOrEqual(400);
    for (const body of [{ action: text }, { action: "join", name: text, avatar: text }, { action: "progress", event: text, round: text }, { action: "progress", event: "round", round: 1, solved: text, hints: text }]) {
      await calm(`room action ${label}`, () => request.post(`/api/rooms/${quoted || "%20"}`, { data: body }));
    }

    // Accounts: the passkey id in the address, and the id inside a login answer.
    await calm(`passkey id ${label}`, () => request.delete(`/api/account/passkeys/${quoted || "%20"}`));
    await calm(`login id ${label}`, () => request.post("/api/account/login", { data: { action: "verify", response: { id: text, rawId: text, type: text, response: { clientDataJSON: text, authenticatorData: text, signature: text, userHandle: text } } }, headers: { origin } }));
    await calm(`register ${label}`, () => request.post("/api/account/register", { data: { action: "verify", response: { id: text, response: {} }, label: text }, headers: { origin } }));

    // Reminders: the endpoint is a URL the server would call, so it is the strictest field of all.
    expect(await calm(`push endpoint ${label}`, () => request.post("/api/push", { data: { subscription: { endpoint: text, keys: { p256dh: text, auth: text } }, locale: text, timezone: text } }))).toBe(400);
    expect(await calm(`push timezone ${label}`, () => request.post("/api/push", { data: { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: PUSH_KEYS }, locale: "en", timezone: text } }))).toBe(400);
    await calm(`push delete ${label}`, () => request.delete("/api/push", { data: { endpoint: text, auth: text } }));
    await calm(`push delete auth ${label}`, () => request.delete("/api/push", { data: { endpoint: "https://fcm.googleapis.com/fcm/send/x", auth: text } }));
    await calm(`push status ${label}`, () => request.post("/api/push", { data: { action: "status", endpoint: text } }));
    await calm(`push action ${label}`, () => request.post("/api/push", { data: { action: text, endpoint: text } }));
    await calm(`push query ${label}`, () => request.get(`/api/push?endpoint=${quoted}`));
  };
  for (let index = 0; index < HOSTILE.length; index += 6) await Promise.all(HOSTILE.slice(index, index + 6).map(attack));

  // Values of the wrong type altogether, where text, a number or an object is expected.
  for (const shape of SHAPES) {
    const label = JSON.stringify(shape).slice(0, 40);
    await calm(`name ${label}`, () => request.patch("/api/session", { data: { name: shape, nickname: shape, avatar: shape } }));
    await calm(`score ${label}`, () => request.post("/api/scores", { data: score({ game: shape, variant: shape, date: shape, board: shape }) }));
    await calm(`score numbers ${label}`, () => request.post("/api/scores", { data: score({ game: "wend", elapsedMs: shape, hintsUsed: shape, mistakes: shape, moves: shape, size: shape, number: shape }) }));
    await calm(`rooms ${label}`, () => request.post("/api/rooms", { data: { rounds: shape, rematchOf: shape } }));
    await calm(`rounds ${label}`, () => request.post("/api/rooms", { data: { rounds: [shape, { game: shape, difficulty: shape, size: shape, lang: shape }] } }));
    await calm(`open ${label}`, () => request.post("/api/daily", { data: { game: shape, variant: shape, date: shape, hints: shape } }));
    await calm(`push ${label}`, () => request.post("/api/push", { data: { subscription: shape, locale: shape, timezone: shape } }));
    await calm(`push status ${label}`, () => request.post("/api/push", { data: { action: "status", endpoint: shape } }));
    await calm(`push delete ${label}`, () => request.delete("/api/push", { data: { endpoint: shape, auth: shape } }));
    await calm(`logout ${label}`, () => bird.request.post("/api/account/logout", { data: { everywhere: shape } }));
    await calm(`login ${label}`, () => request.post("/api/account/login", { data: { action: shape, response: shape }, headers: { origin } }));
  }
  // Bodies that are not JSON objects at all, some of them not JSON. Sent as bytes, so they arrive exactly as written.
  for (const raw of ["", "null", "[]", '"text"', "{", '{"name":', "'; drop table players; --", "\u0000", "\ufeff{}"]) {
    for (const path of ["/api/session", "/api/scores", "/api/rooms", "/api/daily", "/api/push", "/api/account/merge", "/api/account/logout"]) {
      await calm(`raw body ${JSON.stringify(raw)} to ${path}`, () => request.post(path, { data: Buffer.from(raw, "utf8"), headers: { "content-type": "application/json" } }));
    }
  }

  // The schema has the tables and columns it had, no more and no fewer, and the bystander was not touched.
  expect(await shapeOfSchema()).toEqual(before.shape);
  expect(await bird.row()).toEqual(before.row);
  expect(await bird.scores()).toEqual(before.scores);
  // The site still works for everyone.
  expect(((await (await bird.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(bird.id);
  expect((await request.get("/api/ranking?period=today&game=all")).status()).toBe(200);
  await bird.request.dispose();
});

test("hostile cookies and headers identify nobody", async ({ playwright, baseURL }) => {
  const bird = await canary(playwright, baseURL);
  const before = await bird.row();
  const uuid = bird.id;
  const forged = [
    "x",
    "'; DROP TABLE players; --",
    `${uuid}`,
    `${uuid}.`,
    `${uuid}.short`,
    `${uuid}.${"a".repeat(43)}`,
    `${uuid}.' OR '1'='1' -- ${"a".repeat(30)}`,
    `${uuid}' OR '1'='1.${"a".repeat(43)}`,
    `00000000-0000-0000-0000-000000000000.${"a".repeat(43)}`,
    `${uuid}.${"a".repeat(5000)}`,
    "%00",
    `..${"a".repeat(60)}`,
  ];
  for (const value of forged) {
    for (const cookie of ["play_player", "play_session"]) {
      const visitor = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `${cookie}=${encodeURIComponent(value)}` } });
      const label = `${cookie}=${value.slice(0, 50)}`;
      // Knowing a player's id is not being that player: the secret is checked against its hash, in constant time.
      const session = await visitor.get("/api/session");
      expect(session.status(), label).toBe(200);
      expect(((await session.json()) as { player: unknown }).player, label).toBeNull();
      // And nothing that needs a player lets this one through.
      expect(await calm(`merge with ${label}`, () => visitor.post("/api/account/merge", { data: {} }))).toBe(401);
      expect(await calm(`delete with ${label}`, () => visitor.delete("/api/account"))).toBe(401);
      expect(await calm(`rename with ${label}`, () => visitor.patch("/api/session", { data: { nickname: "taken_over" } }))).toBeLessThan(500);
      await visitor.dispose();
    }
  }
  // Headers a client can set to anything.
  const visitor = await playwright.request.newContext({ baseURL });
  for (const headers of [{ "x-forwarded-for": "'; DROP TABLE players; --" }, { "x-forwarded-host": "evil.example" }, { "x-vercel-ip-country": "'; --" }, { "accept-language": "'; DROP TABLE players; --" }, { host: "evil.example" }] as Record<string, string>[]) {
    await calm(`header ${JSON.stringify(headers)}`, () => visitor.get("/api/session", { headers }));
    await calm(`header ${JSON.stringify(headers)} on a page`, () => visitor.get("/", { headers, maxRedirects: 0 }));
  }
  await visitor.dispose();
  expect(await bird.row()).toEqual(before);
  await bird.request.dispose();
});

test("a player cannot act as, or on, another player", async ({ page, playwright, baseURL }) => {
  await skipTutorials(page);
  // Ana: a player with a room, a score, an account and a passkey.
  const key = await authenticator(page);
  await page.request.post("/api/scores", { data: score() });
  const room = ((await (await page.request.post("/api/rooms", { data: { rounds: [{ game: "zip", difficulty: "easy" }], name: "Ana" } })).json()) as { room: { code: string; rounds: { token: string }[] } }).room;
  await openProfile(page);
  await page.getByTestId("account-create").click();
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  const ana = ((await (await page.request.get("/api/account")).json()) as { player: { id: string; nickname: string }; passkeys: { id: string }[] });
  expect(ana.passkeys).toHaveLength(1);
  void key;

  const mallory = await playwright.request.newContext({ baseURL });
  const origin = new URL((await mallory.get("/api/session")).url()).origin;
  const self = ((await (await mallory.post("/api/session", { data: { name: "Mallory" } })).json()) as { player: { id: string } }).player;

  // Ana's passkeys: not listed, and not removable, by anyone else. A second passkey would make hers removable, so add the check both ways.
  expect(((await (await mallory.get("/api/account")).json()) as { passkeys: unknown[] }).passkeys).toEqual([]);
  expect((await mallory.delete(`/api/account/passkeys/${ana.passkeys[0].id}`)).status()).toBe(409);
  expect(await sql("select count(*)::int as rows from {schema}.passkeys where player_id = $1", [ana.player.id])).toEqual([{ rows: 1 }]);

  // Ana's nickname is hers.
  expect((await mallory.patch("/api/session", { data: { nickname: ana.player.nickname } })).status()).toBe(409);
  // A body cannot name the player it wants to be: ids in a body are ignored, the cookie decides.
  await mallory.patch("/api/session", { data: { id: ana.player.id, player_id: ana.player.id, name: "Mallory 2" } });
  expect((await sql<{ name: string }>("select name from {schema}.players where id = $1", [ana.player.id]))[0].name).not.toBe("Mallory 2");
  await mallory.post("/api/scores", { data: { ...score({ game: "chess" }), player: ana.player.id, playerId: ana.player.id, player_id: ana.player.id } });
  expect(await sql("select count(*)::int as rows from {schema}.daily_scores where player_id = $1 and game = 'chess'", [ana.player.id])).toEqual([{ rows: 0 }]);

  // Ana's room: anyone with the code may look, as the invitation does, but the seeds stay on the server until the race starts,
  // only the host starts it, and nobody reports progress without having joined.
  const seen = ((await (await mallory.get(`/api/rooms/${room.code}`)).json()) as { room: { rounds: { token: string }[]; you: string | null } }).room;
  expect(seen.rounds.every((round) => round.token === "")).toBe(true);
  expect(seen.you).toBeNull();
  expect((await mallory.post(`/api/rooms/${room.code}`, { data: { action: "start" } })).status()).toBe(403);
  await mallory.post(`/api/rooms/${room.code}`, { data: { action: "progress", event: "round", round: 1, solved: true, hints: 0 } });
  await mallory.post(`/api/rooms/${room.code}`, { data: { action: "leave" } });
  expect(await sql("select player_id::text from {schema}.room_players where room_code = $1", [room.code])).toEqual([{ player_id: ana.player.id }]);
  expect(await sql("select status from {schema}.rooms where code = $1", [room.code])).toEqual([{ status: "lobby" }]);

  // Merging and deleting act on the caller alone.
  expect((await mallory.post("/api/account/merge", { data: {} })).status()).toBe(403);
  // A login answer made up for Ana's passkey has no signature that checks out, and no challenge behind it.
  expect((await mallory.post("/api/account/login", { data: { action: "verify", response: { id: ana.passkeys[0].id } }, headers: { origin } })).status()).toBe(400);
  await mallory.post("/api/account/login", { data: { action: "options" }, headers: { origin } });
  expect((await mallory.post("/api/account/login", { data: { action: "verify", response: { id: ana.passkeys[0].id, rawId: ana.passkeys[0].id, type: "public-key", response: { clientDataJSON: "e30", authenticatorData: "AAAA", signature: "AAAA" }, clientExtensionResults: {} } }, headers: { origin } })).status()).toBe(400);
  expect(((await (await mallory.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(self.id);

  expect((await mallory.delete("/api/account")).status()).toBe(200);
  expect(await sql("select count(*)::int as rows from {schema}.players where id = $1", [ana.player.id])).toEqual([{ rows: 1 }]);
  expect(await sql("select count(*)::int as rows from {schema}.daily_scores where player_id = $1", [ana.player.id])).toEqual([{ rows: 1 }]);
  await mallory.dispose();
});

test("an error says what went wrong in one word, and nothing about the inside", async ({ request }) => {
  for (const [path, body] of [
    ["/api/scores", { game: "zip" }],
    ["/api/rooms", { rounds: "x" }],
    ["/api/rooms/ZZZZZ", { action: "start" }],
    ["/api/account/passkeys/x", null],
  ] as const) {
    const answer = body === null ? await request.delete(path) : await request.post(path, { data: body });
    const text = await answer.text();
    expect(answer.status(), path).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(text), path).toEqual({ error: expect.stringMatching(/^[a-z-]+$/) });
    for (const leak of ["select ", "insert ", "postgres", "neon", "stack", " at ", "node_modules", SCHEMA]) expect(text.toLowerCase(), `${path} leaks "${leak}"`).not.toContain(leak);
    expect(answer.headers()["cache-control"], path).toBe("no-store");
  }
});

test("an account's other sessions can all be ended, and the secret of the device it was made on stops working", async ({ page, browser, playwright, baseURL }) => {
  await skipTutorials(page);
  // The phone is a device player first. This is the cookie it has before the account exists.
  await page.request.post("/api/scores", { data: score() });
  const before = (await page.context().cookies()).find((cookie) => cookie.name === "play_player");
  expect(before?.value).toMatch(/^[0-9a-f-]{36}\./);
  const withOldSecret = async () => {
    const visitor = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `play_player=${before?.value}` } });
    const player = ((await (await visitor.get("/api/session")).json()) as { player: unknown }).player;
    await visitor.dispose();
    return player;
  };
  expect(await withOldSecret()).toBeTruthy();

  const credential = await createAccount(page);
  // Making the account gave the phone a session. Its next request shows the session arrived, and that is when the secret
  // is retired: a copy of the old cookie is nobody from then on.
  await page.request.get("/api/session");
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "play_player")).toBeUndefined();
  expect(cookies.find((cookie) => cookie.name === "play_session")).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(await withOldSecret()).toBeNull();
  const me = ((await (await page.request.get("/api/session")).json()) as { player: { id: string; account: boolean } }).player;
  expect(me.account).toBe(true);

  // A second device signs in, and has reminders on. Signing out the other devices from the first ends the second, and
  // its reminders. The first stays signed in, with the session it had: its own way in is never touched.
  const sessionBefore = cookies.find((cookie) => cookie.name === "play_session")?.value;
  const computer = await device(browser);
  await signIn(computer, credential);
  expect(((await (await computer.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(me.id);
  const endpoint = pushEndpoint();
  const subscription = { endpoint, keys: PUSH_KEYS };
  expect((await computer.request.post("/api/push", { data: { subscription, locale: "en", timezone: "UTC" } })).status()).toBe(200);
  await openProfile(page);
  await page.getByTestId("account-sign-out-everywhere").click();
  await expect(page.getByTestId("account-everywhere-confirm")).toContainText("Every other device signed in to this account is signed out");
  const answered = page.waitForResponse((response) => response.url().endsWith("/api/account/logout"));
  await page.getByTestId("account-everywhere-confirm").locator('.mg-button[data-variant="primary"]').click();
  expect((await answered).status()).toBe(200);
  await expect(page.getByTestId("profile")).toHaveAttribute("data-account", "true");
  expect(((await (await page.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(me.id);
  const sessionAfter = (await page.context().cookies()).find((cookie) => cookie.name === "play_session")?.value;
  expect(sessionBefore).toBeTruthy();
  expect(sessionAfter).toBe(sessionBefore);
  expect(((await (await computer.request.get("/api/session")).json()) as { player: unknown }).player).toBeNull();
  expect(await sql("select count(*)::int as rows from {schema}.sessions where player_id = $1", [me.id])).toEqual([{ rows: 1 }]);
  expect(await sql("select count(*)::int as rows from {schema}.push_subscriptions where endpoint = $1", [endpoint])).toEqual([{ rows: 0 }]);
  // The account is still there, one passkey away. The computer's authenticator still holds it.
  await openProfile(computer);
  await computer.getByTestId("account-sign-in").click();
  await expect(computer.getByTestId("profile")).toHaveAttribute("data-account", "true");
  expect(((await (await computer.request.get("/api/session")).json()) as { player: { id: string } }).player.id).toBe(me.id);
  await computer.context().close();
});

test("a room never holds more players than it allows, however many arrive at once", async ({ request, playwright, baseURL }) => {
  const room = ((await (await request.post("/api/rooms", { data: { rounds: [{ game: "zip", difficulty: "easy" }] } })).json()) as { room: { code: string } }).room;
  // Thirty strangers, each a new player, all joining in the same instant.
  const crowd = await Promise.all(Array.from({ length: 30 }, () => playwright.request.newContext({ baseURL })));
  const answers = await Promise.all(crowd.map((visitor) => visitor.post(`/api/rooms/${room.code}`, { data: { action: "join" } })));
  const statuses = answers.map((answer) => answer.status());
  expect(statuses.every((status) => status === 200 || status === 409), statuses.join(" ")).toBe(true);
  expect(await sql("select count(*)::int as players from {schema}.room_players where room_code = $1", [room.code])).toEqual([{ players: 12 }]);
  expect(statuses.filter((status) => status === 200)).toHaveLength(11);
  await Promise.all(crowd.map((visitor) => visitor.dispose()));
});

test("every answer carries the headers that keep other sites out, and oversized or malformed requests are turned away", async ({ request }) => {
  for (const path of ["/en", "/en/zip", "/en/profile", "/api/session", "/manifest.webmanifest"]) {
    const headers = (await request.get(path)).headers();
    // No other site may put this one in a frame.
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("publickey-credentials-get=(self)");
    expect(headers["strict-transport-security"], path).toContain("max-age=");
    expect(headers["x-powered-by"], path).toBeUndefined();
    // And nothing invites another origin to read the answers.
    expect(headers["access-control-allow-origin"], path).toBeUndefined();
  }

  // A body larger than any route has a use for is refused before it is parsed.
  const huge = await request.post("/api/session", { data: { name: "x", padding: "y".repeat(70_000) } });
  expect(huge.status()).toBe(413);
  expect(await huge.json()).toEqual({ error: "too-large" });

  // An address under /rooms/ that cannot be a room code is not a page, in any spelling.
  for (const path of ["/en/rooms/not-a-room", "/en/rooms/%3Cscript%3E", "/en/rooms/AAAAAAAAAAAAAAAA", "/en/rooms/O0O0O"]) {
    const missing = await request.get(path);
    expect(missing.status(), path).toBe(404);
    // It does not pass itself off as another page, the home page least of all.
    expect(await missing.text(), path).not.toContain('rel="canonical"');
  }
  // A room's canonical address is its own: it is what a browser's Share menu sends.
  const room = await request.get("/en/rooms/abcde");
  expect(room.status()).toBe(200);
  expect(await room.text()).toContain('<link rel="canonical" href="https://play.brunosilva.io/en/rooms/ABCDE"/>');
});
