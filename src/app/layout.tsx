import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces } from "next/font/google";
import { PLATFORM_NAME } from "@/games/registry";
import { ServiceWorker } from "@/shared/platform/service-worker";
import { SITE_ORIGIN } from "@/shared/platform/site";
import "./globals.css";
import "@/shared/ui/theme.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });
const body = Bricolage_Grotesque({ variable: "--font-body", subsets: ["latin"] });

const description = "Small daily logic puzzles. A new board for every game each day, with streaks, hints and unlimited practice.";

export const metadata: Metadata = {
  // Open Graph image URLs are resolved against the canonical address.
  metadataBase: new URL(SITE_ORIGIN),
  alternates: { canonical: "/" },
  title: { default: `${PLATFORM_NAME} | Daily Logic Puzzles`, template: `%s | ${PLATFORM_NAME}` },
  description,
  manifest: "/manifest.webmanifest",
  applicationName: PLATFORM_NAME,
  appleWebApp: { capable: true, title: PLATFORM_NAME, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/platform.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // The Open Graph images are static files in public/og, rendered once by `npm run og`.
  openGraph: {
    type: "website",
    siteName: PLATFORM_NAME,
    title: `${PLATFORM_NAME} | Daily Logic Puzzles`,
    description,
    url: "/",
    images: [{ url: "/og/home.png", width: 1200, height: 630, alt: `${PLATFORM_NAME}: small daily logic puzzles` }],
  },
  twitter: { card: "summary_large_image", title: `${PLATFORM_NAME} | Daily Logic Puzzles`, description, images: ["/og/home.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1a17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <div className="mg-root">{children}</div>
        <ServiceWorker />
      </body>
    </html>
  );
}
