import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Termo | Daily Puzzle";
const description = "Guess the hidden five-letter Portuguese word in six tries, or two and four words at once. A new word every day, plus unlimited practice.";
const image = { url: "/og/termo.png", width: 1200, height: 630, alt: `${GAMES.termo.name}: ${GAMES.termo.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Termo" },
  description,
  alternates: { canonical: GAMES.termo.path },
  icons: { icon: [{ url: "/icons/termo.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.termo.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function TermoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
