import { expect, test } from "@playwright/test";
import { skipTutorials } from "../shared";
import { board as patchesBoard, cellCenter, draw, openPuzzle, practicePuzzle, regions, sweep } from "../patches/helpers";
import { board as zipBoard, cellPoint, drawCells, openZip, visited, zipPuzzle } from "../zip/helpers";

const patches = practicePuzzle("e2e-mobile", "hard", 8);
const zip = zipPuzzle("e2e-mobile", "hard", 8);

test.beforeEach(async ({ page }) => {
  await skipTutorials(page);
});

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const game of ["zip", "patches"] as const) {
  for (const viewport of VIEWPORTS) {
    test(`${game} ${viewport.width}x${viewport.height}: square cells on whole pixels, no overflow, reachable controls`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (game === "zip") await openZip(page, zip.url);
      else await openPuzzle(page, patches.url);
      const board = game === "zip" ? zipBoard(page) : patchesBoard(page);

      const box = (await board.boundingBox())!;
      expect(Math.abs(box.width - box.height)).toBeLessThan(1);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      if (viewport.width < 500) expect(box.width).toBeGreaterThan(viewport.width * 0.85);

      const grid = (await board.getByRole("grid").boundingBox())!;
      expect(grid.width % 8).toBe(0);
      expect(Number.isInteger(grid.x)).toBe(true);
      expect(grid.width / 8).toBeGreaterThanOrEqual(36);

      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(overflow).toEqual({ x: 0, y: 0 });

      for (const name of ["Undo", /^Hint/, "Reveal", "Reset"]) {
        const button = (await page.getByRole("button", { name }).boundingBox())!;
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.y + button.height).toBeLessThanOrEqual(viewport.height);
      }
    });
  }
}

test("real touch input draws in both games and never scrolls the page", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "mobile", "needs touch emulation over CDP");
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (points: { x: number; y: number }[]) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [points[0]] });
    for (let leg = 1; leg < points.length; leg++) {
      for (let step = 1; step <= 4; step++) {
        const point = { x: points[leg - 1].x + ((points[leg].x - points[leg - 1].x) * step) / 4, y: points[leg - 1].y + ((points[leg].y - points[leg - 1].y) * step) / 4 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
      }
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  await openZip(page, zip.url);
  const zipGrid = zipBoard(page).getByRole("grid");
  const zipPoints = [];
  for (const cell of zip.puzzle.solution.slice(0, 6)) zipPoints.push(await cellPoint(zipGrid, 8, cell));
  await swipe(zipPoints);
  await expect(visited(page)).toHaveCount(6);
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
  expect(await zipBoard(page).evaluate((element: HTMLElement) => getComputedStyle(element).touchAction)).toBe("none");

  await openPuzzle(page, patches.url);
  const patchesGrid = patchesBoard(page).getByRole("grid");
  const patchPoints = [];
  for (const cell of sweep(patches.targets[0])) patchPoints.push(await cellCenter(patchesGrid, 8, cell));
  await swipe(patchPoints);
  await expect(regions(page)).toHaveCount(1);
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".mg-root")!).userSelect)).toBe("none");
});

test("the manifest makes the platform installable", async ({ page, request }) => {
  await page.goto("/");
  expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toBe("/manifest.webmanifest");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(true);
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((shortcut: { icons: { src: string }[] }) => shortcut.icons)]) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
  expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual(["/zip", "/patches"]);
});

test("after one online visit the hub and both games load and play offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 150; i++) {
      const keys = await (await caches.open("minigames-shell-v1")).keys();
      const has = (suffix: string) => keys.some((key) => new URL(key.url).pathname === suffix);
      if (navigator.serviceWorker.controller && has("/zip/play") && has("/patches/play") && keys.some((key) => key.url.includes("/_next/static/"))) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("service worker did not finish precaching");
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("hub-card-zip")).toBeVisible();

  // Seeds never seen online: the page comes from cache and the puzzle is built on the device.
  await openZip(page, zip.url);
  await drawCells(page, 8, zip.puzzle.solution.slice(0, 5));
  await expect(visited(page)).toHaveCount(5);

  await openPuzzle(page, patches.url);
  await draw(page, 8, patches.targets[0]);
  await expect(regions(page)).toHaveCount(1);
  await context.setOffline(false);
});
