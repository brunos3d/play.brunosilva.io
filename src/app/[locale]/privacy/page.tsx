import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalScreen } from "@/shared/legal/legal-screen";
import { onlineMetadata } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return onlineMetadata((await params).locale, "privacy", "/privacy");
}

export default async function PrivacyPage({ params }: Props) {
  setRequestLocale((await params).locale);
  return <LegalScreen kind="privacy" />;
}
