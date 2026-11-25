import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RankingScreen } from "@/shared/online/ranking-screen";
import { onlineMetadata } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return onlineMetadata((await params).locale, "ranking", "/ranking");
}

export default async function RankingPage({ params }: Props) {
  setRequestLocale((await params).locale);
  return <RankingScreen />;
}
