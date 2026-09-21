import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", image: "/og/home.png", title: /Minigames/ },
  { path: "/zip", image: "/og/zip.png", title: /Zip/ },
  { path: "/patches", image: "/og/patches.png", title: /Patches/ },
];

for (const entry of PAGES) {
  test(`${entry.path} advertises its own 1200x630 Open Graph image on the canonical domain`, async ({ page, request }) => {
    await page.goto(entry.path);
    const meta = (property: string) => page.locator(`meta[property="${property}"]`).first().getAttribute("content");

    expect(await meta("og:image")).toBe(`https://play.brunosilva.io${entry.image}`);
    expect(await meta("og:image:width")).toBe("1200");
    expect(await meta("og:image:height")).toBe("630");
    expect(await meta("og:title")).toMatch(entry.title);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");
    expect(await page.locator('meta[name="twitter:image"]').getAttribute("content")).toBe(`https://play.brunosilva.io${entry.image}`);
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`https://play.brunosilva.io${entry.path === "/" ? "" : entry.path}`);

    // The image is a static file with the advertised size. PNG stores width and height at bytes 16 to 24.
    const response = await request.get(entry.image);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
    const bytes = await response.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  });
}
