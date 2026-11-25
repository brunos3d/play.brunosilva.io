import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PLATFORM_NAME } from "@/games/registry";
import { LOCALES, LOCALE_META, isLocale } from "@/i18n/config";
import { localizedAlternates, openGraphLocales } from "@/shared/platform/metadata";
import { ServiceWorker } from "@/shared/platform/service-worker";
import { SITE_ORIGIN } from "@/shared/platform/site";
import { ThemeScript } from "@/shared/ui/theme-script";
import { ThemeSync } from "@/shared/ui/theme-sync";
import "../globals.css";
import "@/shared/ui/theme.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });
const body = Bricolage_Grotesque({ variable: "--font-body", subsets: ["latin"] });

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/** Both locales are built ahead of time. Every page under this layout is static. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  const title = t("home.title");
  const description = t("home.description");
  return {
    // Open Graph image URLs are resolved against the canonical address.
    metadataBase: new URL(SITE_ORIGIN),
    alternates: localizedAlternates(locale, "/"),
    title: { default: title, template: `%s | ${PLATFORM_NAME}` },
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
      title,
      description,
      url: localizedAlternates(locale, "/").canonical,
      ...openGraphLocales(locale),
      images: [{ url: "/og/home.png", width: 1200, height: 630, alt: t("home.imageAlt") }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og/home.png"] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // One per colour scheme, for a first paint that follows the device. ThemeSync overrides both when the player picks a theme by hand.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1a17" },
  ],
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    // The theme script sets data-theme on <html> before React hydrates, which React would otherwise report as a mismatch.
    <html lang={LOCALE_META[locale].htmlLang} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <NextIntlClientProvider>
          <div className="mg-root">{children}</div>
          <ThemeSync />
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
