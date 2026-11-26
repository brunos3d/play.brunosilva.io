import { expect, test } from "@playwright/test";
import { CONSENT_KEY, skipTutorials } from "../shared";

/**
 * The cookie notice of a first visit, and the two pages it leads to. Every
 * other test starts with the notice answered (see playwright.config.ts).
 * These start as a visitor who has never been here.
 */
test.describe("a first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("says what the site stores, leads to the privacy policy, and is answered once", async ({ page }) => {
    await skipTutorials(page);
    await page.goto("/");
    const notice = page.getByTestId("consent");
    await expect(notice).toContainText("cookies and your browser's storage only to work");
    await expect(notice).toContainText("No ads, no tracking");
    // One answer: everything the site stores is needed for something the visitor asks for.
    await expect(notice.getByRole("button")).toHaveText(["Accept"]);

    // The page under the notice stays usable, and the notice follows to the policy it links to.
    await expect(page.getByTestId("hub-card-zip")).toBeVisible();
    await notice.getByRole("link", { name: "privacy policy" }).click();
    await expect(page).toHaveURL(/\/en\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect(page.getByTestId("legal-privacy")).toContainText("Privacy policy");
    await expect(notice).toBeVisible();

    await page.getByTestId("consent-accept").click();
    await expect(notice).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY)).toContain("accepted");
    await page.goto("/zip");
    await expect(page.getByTestId("game-home")).toBeVisible();
    await expect(notice).toHaveCount(0);
  });

  test("reads in Portuguese", async ({ page }) => {
    await skipTutorials(page);
    await page.goto("/pt-br");
    const notice = page.getByTestId("consent");
    await expect(notice).toContainText("Sem anúncios, sem rastreamento");
    await expect(notice.getByRole("button")).toHaveText(["Aceitar"]);
    await notice.getByRole("link", { name: "termos de uso" }).click();
    await expect(page).toHaveURL(/\/pt-br\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "Termos" })).toBeVisible();
    await expect(page.getByTestId("legal-terms")).toContainText("Termos de uso");
  });
});

test("the privacy policy names every cookie the site sets and says how to delete the data", async ({ page, request }) => {
  await page.goto("/privacy");
  const policy = page.getByTestId("legal-privacy");
  for (const cookie of ["NEXT_LOCALE", "play_player", "play_session", "play_challenge"]) await expect(policy).toContainText(cookie);
  await expect(policy).toContainText("You can delete your player and everything stored about it at any time, on the Profile page.");
  await expect(policy).toContainText(/Last updated on \w+ \d+, \d{4}/);

  // The policy and the code agree: a visit and a score set these cookies and no others.
  await request.get("/");
  await request.post("/api/scores", { data: { game: "zip", date: "2026-01-01", number: 1, difficulty: "medium", size: 6, elapsedMs: 60_000, hintsUsed: 0, mistakes: 0 } });
  const cookies = (await request.storageState()).cookies.map((cookie) => cookie.name).sort();
  expect(cookies).toEqual(["NEXT_LOCALE", "play_player"]);
});

test("the legal pages are in both languages and linked from every footer", async ({ page }) => {
  await skipTutorials(page);
  await page.goto("/pt-br/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacidade" })).toBeVisible();
  await expect(page.getByTestId("legal-privacy")).toContainText("Política de privacidade");
  await expect(page.getByTestId("legal-privacy")).toContainText("O site nunca pede e-mail, senha, telefone nem o seu nome verdadeiro.");
  await expect(page.getByTestId("legal-privacy")).toContainText(/Atualizado em \d+ de \w+ de \d{4}/);
  await page.locator("footer").getByRole("link", { name: "Termos" }).click();
  await expect(page).toHaveURL(/\/pt-br\/terms$/);
  await expect(page.getByTestId("legal-terms")).toContainText("Jogo limpo");

  // The hub and a game both lead to them.
  await page.goto("/en");
  await page.locator("footer").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await page.goto("/en/zip");
  await page.locator("footer").getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/\/en\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await expect(page.getByTestId("legal-terms")).toContainText("Terms of use");
});
