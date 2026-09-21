import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Patches | Daily Puzzle";
const description = "Cover the grid with rectangles, one clue each. A new board every day, plus unlimited practice.";
const image = { url: "/og/patches.png", width: 1200, height: 630, alt: `${GAMES.patches.name}: ${GAMES.patches.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Patches" },
  description,
  alternates: { canonical: GAMES.patches.path },
  icons: { icon: [{ url: "/icons/patches.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.patches.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function PatchesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
