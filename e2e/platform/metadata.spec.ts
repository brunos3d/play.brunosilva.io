import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", image: "/og/home.png", title: /Minigames/ },
  { path: "/zip", image: "/og/zip.png", title: /Zip/ },
  { path: "/patches", image: "/og/patches.png", title: /Patches/ },
  { path: "/chess", image: "/og/chess.png", title: /Chess/ },
  { path: "/queens", image: "/og/queens.png", title: /Queens/ },
  { path: "/sumbreak", image: "/og/sumbreak.png", title: /Sumbreak/ },
  { path: "/wend", image: "/og/wend.png", title: /Wend/ },
  { path: "/termo", image: "/og/termo.png", title: /Termo/ },
];

for (const entry of PAGES) {
  test(`${entry.path} advertises its own 1200x630 Open Graph image on the canonical domain`, async ({ page, request }) => {
    // The bare path is redirected to /en: the browser of these tests asks for English.
    await page.goto(entry.path);
    const meta = (property: string) => page.locator(`meta[property="${property}"]`).first().getAttribute("content");

    expect(await meta("og:image")).toBe(`https://play.brunosilva.io${entry.image}`);
    expect(await meta("og:image:width")).toBe("1200");
    expect(await meta("og:image:height")).toBe("630");
    expect(await meta("og:title")).toMatch(entry.title);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");
    expect(await page.locator('meta[name="twitter:image"]').getAttribute("content")).toBe(`https://play.brunosilva.io${entry.image}`);
    // Each locale is its own canonical page, and names the other one and the bare path as alternates.
    const suffix = entry.path === "/" ? "" : entry.path;
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`https://play.brunosilva.io/en${suffix}`);
    expect(await page.locator('link[rel="alternate"][hreflang="pt-BR"]').getAttribute("href")).toBe(`https://play.brunosilva.io/pt-br${suffix}`);
    expect(await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute("href")).toBe(`https://play.brunosilva.io/en${suffix}`);
    expect(await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute("href")).toBe(`https://play.brunosilva.io${suffix}`);
    expect(await meta("og:locale")).toBe("en_US");

    // The image is a static file with the advertised size. PNG stores width and height at bytes 16 to 24.
    const response = await request.get(entry.image);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
    const bytes = await response.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  });
}

test("the Portuguese pages carry Portuguese titles and descriptions, and the same images", async ({ page }) => {
  await page.goto("/pt-br");
  await expect(page).toHaveTitle("Minigames | Desafios de lógica diários");
  expect(await page.locator("html").getAttribute("lang")).toBe("pt-BR");
  expect(await page.locator('meta[property="og:locale"]').getAttribute("content")).toBe("pt_BR");
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe("https://play.brunosilva.io/pt-br");

  await page.goto("/pt-br/chess");
  await expect(page).toHaveTitle("Xadrez | Desafio diário | Minigames");
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toContain("treinadora");
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toBe("https://play.brunosilva.io/og/chess.png");

  await page.goto("/pt-br/zip/practice");
  await expect(page).toHaveTitle("Prática | Zip");
});
