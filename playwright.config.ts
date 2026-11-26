import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const ORIGIN = `http://localhost:${PORT}`;
export const E2E_DB_SCHEMA = "play_e2e";
/** The secret the tests call the scheduled route with. The real one is in the Vercel project. */
export const E2E_CRON_SECRET = "e2e-cron-secret";
/** A key pair made for the tests and used nowhere else. With PUSH_DRY_RUN nothing is ever signed with it or sent. */
const E2E_VAPID = { publicKey: "BLL_6F5cJxoRRSNJOnbAf9_dry3x5OsZBTSK4wfYa0jJ2-8TRPZd_gtssUZmclgw9FqiZYAVJurP4qG4VjYb9Ao", privateKey: "9OZxGM_wP6pS5XXJYkTyGGui29BBV8JycqBbxj35Pqo" };

export default defineConfig({
  testDir: "./e2e",
  // Empties the tables of the test schema, so every run starts without the players and rooms of the one before.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: ORIGIN,
    trace: "retain-on-failure",
    // Every test starts as a visitor who has answered the cookie notice: it sits over the bottom of the page, where the controls are.
    // The notice's own tests ask for an empty storage state. The key is CONSENT_KEY in e2e/shared.ts.
    storageState: { cookies: [], origins: [{ origin: ORIGIN, localStorage: [{ name: "minigames:consent:v1", value: JSON.stringify({ accepted: "2026-01-01T00:00:00.000Z" }) }] }] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // The build goes to its own folder: `next dev` may be running from `.next` at the same time. E2E_DIST_DIR names another one, for a second run next to this one (with its own E2E_PORT).
    // The online features write to a Postgres schema of their own, never next to real players. Create it once with `PLAY_DB_SCHEMA=play_e2e npm run db:migrate`.
    // Reminders run dry: who is due is worked out and marked, and no message leaves the machine.
    env: { NEXT_DIST_DIR: process.env.E2E_DIST_DIR ?? ".next-e2e", PLAY_DB_SCHEMA: E2E_DB_SCHEMA, CRON_SECRET: E2E_CRON_SECRET, VAPID_PUBLIC_KEY: E2E_VAPID.publicKey, VAPID_PRIVATE_KEY: E2E_VAPID.privateKey, PUSH_DRY_RUN: "1" },
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
