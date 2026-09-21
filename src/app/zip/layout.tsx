import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Zip | Daily Puzzle";
const description = "Draw one path through every cell, passing the numbers in order. A new board every day, plus unlimited practice.";
const image = { url: "/og/zip.png", width: 1200, height: 630, alt: `${GAMES.zip.name}: ${GAMES.zip.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Zip" },
  description,
  alternates: { canonical: GAMES.zip.path },
  icons: { icon: [{ url: "/icons/zip.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.zip.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function ZipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
