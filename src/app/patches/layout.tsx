import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Patches | Daily Puzzle", template: "%s | Patches" },
  description: "Cover the grid with rectangles, one clue each. A new board every day, plus unlimited practice.",
  icons: { icon: [{ url: "/icons/patches.svg", type: "image/svg+xml" }] },
};

export default function PatchesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
