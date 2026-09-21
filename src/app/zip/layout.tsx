import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Zip | Daily Puzzle", template: "%s | Zip" },
  description: "Draw one path through every cell, passing the numbers in order. A new board every day, plus unlimited practice.",
  icons: { icon: [{ url: "/icons/zip.svg", type: "image/svg+xml" }] },
};

export default function ZipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
