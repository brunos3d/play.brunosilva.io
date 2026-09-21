/**
 * npm run og
 * Renders the Open Graph images once, as static files in public/og. They are
 * committed, so nothing is generated per request or per build. Run it again
 * only when a name, a tagline or an icon changes.
 *
 * Needs network access the first time: the template loads the same two font
 * families the site uses from Google Fonts.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { GAMES, PLATFORM_NAME } from "@/games/registry";
import { SITE_ORIGIN } from "@/shared/platform/site";

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = resolve(process.cwd(), "public/og");
const icon = (name: string): string => readFileSync(resolve(process.cwd(), `public/icons/${name}.svg`), "utf8");
const host = SITE_ORIGIN.replace(/^https?:\/\//, "");

type Card = { file: string; title: string; headline: string; description: string; path: string; art: string };

/** One big icon, tilted a little, on a soft tile. */
const singleArt = (name: string): string => `<div class="tile big" style="transform: rotate(4deg)">${icon(name)}</div>`;

const cards: Card[] = [
  {
    file: "home.png",
    title: PLATFORM_NAME,
    headline: "Small daily logic puzzles",
    description: "One new board per game, every day. Free, in your browser, no sign-up.",
    path: "",
    // Both game icons, staggered so that each one stays readable.
    art: `<div class="pair"><div class="tile small" style="transform: translate(-78px, -74px) rotate(-7deg)">${icon("zip")}</div><div class="tile small" style="transform: translate(78px, 74px) rotate(6deg)">${icon("patches")}</div></div>`,
  },
  { file: "zip.png", title: GAMES.zip.name, headline: GAMES.zip.tagline, description: `${GAMES.zip.description} A new board every day.`, path: GAMES.zip.path, art: singleArt("zip") },
  { file: "patches.png", title: GAMES.patches.name, headline: GAMES.patches.tagline, description: `${GAMES.patches.description} A new board every day.`, path: GAMES.patches.path, art: singleArt("patches") },
];

const page = (card: Card): string => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Fraunces:opsz,wght@9..144,600&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; color: #2a2622; background-color: #f6f1e7;
    background-image: repeating-linear-gradient(0deg, rgb(42 38 34 / 0.022) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgb(42 38 34 / 0.022) 0 1px, transparent 1px 3px);
    font-family: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
    display: grid; grid-template-columns: 1fr 470px; align-items: center;
  }
  .copy { padding: 0 0 0 84px; display: flex; flex-direction: column; gap: 22px; }
  .kicker { display: flex; align-items: center; gap: 14px; font-size: 25px; font-weight: 600; color: #6b635a; letter-spacing: 0.01em; }
  .kicker svg { width: 44px; height: 44px; border-radius: 11px; box-shadow: 0 0 0 2px #d9cfbd; }
  h1 { font-family: "Fraunces", ui-serif, Georgia, serif; font-weight: 600; font-size: ${card.title.length > 7 ? 116 : 148}px; line-height: 0.95; letter-spacing: -0.02em; }
  .headline { font-size: 46px; font-weight: 700; line-height: 1.1; color: #c2553d; }
  .description { font-size: 28px; line-height: 1.4; color: #6b635a; max-width: 600px; }
  .art { display: grid; place-items: center; height: 100%; padding-right: 40px; }
  .tile { width: 270px; height: 270px; border-radius: 64px; overflow: hidden; box-shadow: 0 0 0 3px #d9cfbd, 0 40px 70px -30px rgb(42 38 34 / 0.45); background: #f6f1e7; }
  .tile.big { width: 380px; height: 380px; border-radius: 90px; }
  .tile.small { width: 236px; height: 236px; border-radius: 56px; }
  .tile svg { width: 100%; height: 100%; display: block; }
  .pair { display: grid; }
  .pair .tile { grid-area: 1 / 1; }
  /* A strip of fabric along the bottom edge, one swatch per palette colour. */
  .swatches { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; display: flex; }
  .swatches span { flex: 1; }
</style></head>
<body>
  <div class="copy">
    <div class="kicker">${icon("platform")}<span>${host}${card.path}</span></div>
    <h1>${card.title}</h1>
    <p class="headline">${card.headline}</p>
    <p class="description">${card.description}</p>
  </div>
  <div class="art">${card.art}</div>
  <div class="swatches">${["#f2b5b0", "#f6c89f", "#f3dc8f", "#bfd8a8", "#a9dcc6", "#a8d3ea", "#b7bef0", "#d3b6ea"].map((color) => `<span style="background:${color}"></span>`).join("")}</div>
</body></html>`;

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  for (const card of cards) {
    await tab.setContent(page(card), { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    const loaded = await tab.evaluate(() => [...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family));
    if (!loaded.some((family) => family.includes("Fraunces"))) console.warn(`warning: fonts did not load for ${card.file}, the image uses fallback fonts`);
    await tab.screenshot({ path: resolve(OUT, card.file), clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    console.log(`wrote public/og/${card.file}`);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
