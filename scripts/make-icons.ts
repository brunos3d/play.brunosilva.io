/**
 * npx tsx scripts/make-icons.ts
 * Renders the SVG marks in public/icons to the PNG sizes the manifest lists.
 * Uses the Chromium that Playwright already installs, so no image library is needed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const directory = resolve(process.cwd(), "public/icons");
const targets = [
  { source: "platform.svg", file: "icon-192.png", size: 192, padding: 0 },
  { source: "platform.svg", file: "icon-512.png", size: 512, padding: 0 },
  { source: "platform.svg", file: "apple-touch-icon.png", size: 180, padding: 0 },
  // Maskable icons keep the artwork inside the central 80% safe zone.
  { source: "platform.svg", file: "maskable-512.png", size: 512, padding: 0.1 },
  { source: "zip.svg", file: "zip-192.png", size: 192, padding: 0 },
  { source: "patches.svg", file: "patches-192.png", size: 192, padding: 0 },
];

async function main(): Promise<void> {
  const browser = await chromium.launch();
  for (const target of targets) {
    const svg = readFileSync(resolve(directory, target.source), "utf8");
    const page = await browser.newPage({ viewport: { width: target.size, height: target.size } });
    const inset = Math.round(target.size * target.padding);
    await page.setContent(
      `<body style="margin:0;background:#f6f1e7;display:grid;place-items:center;width:${target.size}px;height:${target.size}px">` +
        `<div style="width:${target.size - inset * 2}px;height:${target.size - inset * 2}px">${svg}</div></body>`,
    );
    await page.screenshot({ path: resolve(directory, target.file) });
    await page.close();
    console.log(`wrote ${target.file}`);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
