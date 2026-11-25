import { setRequestLocale } from "next-intl/server";
import { DailyGame } from "@/games/patches/components/game/daily-game";

export default async function PatchesDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <DailyGame />;
}
