import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Queens | Daily Puzzle";
const description = "Place one queen in every row, column and coloured region so that no two queens touch. A new board every day, plus unlimited practice.";
const image = { url: "/og/queens.png", width: 1200, height: 630, alt: `${GAMES.queens.name}: ${GAMES.queens.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Queens" },
  description,
  alternates: { canonical: GAMES.queens.path },
  icons: { icon: [{ url: "/icons/queens.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.queens.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function QueensLayout({ children }: { children: React.ReactNode }) {
  return children;
}
