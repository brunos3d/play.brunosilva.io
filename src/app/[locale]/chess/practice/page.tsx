import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ChessPractice } from "@/games/chess/components/game/practice";
import { pageTitle } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageTitle((await params).locale, "practice");
}

export default async function ChessPracticePage({ params }: Props) {
  setRequestLocale((await params).locale);
  return <ChessPractice />;
}
