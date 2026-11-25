import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { TermoPracticeSetup } from "@/games/termo/components/game/practice-setup";
import { pageTitle } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageTitle((await params).locale, "practice");
}

export default async function TermoPracticePage({ params }: Props) {
  setRequestLocale((await params).locale);
  return <TermoPracticeSetup />;
}
