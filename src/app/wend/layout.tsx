import type { Metadata } from "next";
import { GAMES, PLATFORM_NAME } from "@/games/registry";

const title = "Wend | Daily Puzzle";
const description = "Trace the hidden Portuguese words through neighbouring letters until every letter is used. A new themed board every day, plus unlimited practice.";
const image = { url: "/og/wend.png", width: 1200, height: 630, alt: `${GAMES.wend.name}: ${GAMES.wend.tagline}` };

export const metadata: Metadata = {
  title: { default: title, template: "%s | Wend" },
  description,
  alternates: { canonical: GAMES.wend.path },
  icons: { icon: [{ url: "/icons/wend.svg", type: "image/svg+xml" }] },
  // A child segment replaces the parent's openGraph as a whole, so every field is repeated here.
  openGraph: { type: "website", siteName: PLATFORM_NAME, title, description, url: GAMES.wend.path, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image.url] },
};

export default function WendLayout({ children }: { children: React.ReactNode }) {
  return children;
}
