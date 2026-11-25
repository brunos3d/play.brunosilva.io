import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DB_SCHEMA = "play_e2e";

export default defineConfig({
  testDir: "./e2e",
  // Empties the tables of the test schema, so every run starts without the players and rooms of the one before.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // The build goes to its own folder: `next dev` may be running from `.next` at the same time. E2E_DIST_DIR names another one, for a second run next to this one (with its own E2E_PORT).
    // The online features write to a Postgres schema of their own, never next to real players. Create it once with `PLAY_DB_SCHEMA=play_e2e npm run db:migrate`.
    env: { NEXT_DIST_DIR: process.env.E2E_DIST_DIR ?? ".next-e2e", PLAY_DB_SCHEMA: E2E_DB_SCHEMA },
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
