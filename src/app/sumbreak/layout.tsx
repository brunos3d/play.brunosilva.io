import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Sumbreak | Daily Puzzle";
const description = "Merge equal neighbours into their sum, in the right order, until a single tile is left. A new board every day, plus unlimited practice.";
const image = { url: "/og/sumbreak.png", width: 1200, height: 630, alt: `${GAMES.sumbreak.name}: ${GAMES.sumbreak.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Sumbreak" },
  description,
  alternates: { canonical: GAMES.sumbreak.path },
  icons: { icon: [{ url: "/icons/sumbreak.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.sumbreak.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function SumbreakLayout({ children }: { children: React.ReactNode }) {
  return children;
}
