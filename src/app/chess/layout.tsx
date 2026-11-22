import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Chess | Daily Puzzle";
const description = "Solve a chess tactic from a generated game: give mate, win material or save the position, with a coach who explains every move. A new puzzle every day, plus unlimited practice.";
const image = { url: "/og/chess.png", width: 1200, height: 630, alt: `${GAMES.chess.name}: ${GAMES.chess.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Chess" },
  description,
  alternates: { canonical: GAMES.chess.path },
  icons: { icon: [{ url: "/icons/chess.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.chess.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function ChessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
