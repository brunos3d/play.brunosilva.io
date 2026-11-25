import { setRequestLocale } from "next-intl/server";
import { SumbreakDailyGame } from "@/games/sumbreak/components/game/daily-game";

export default async function SumbreakDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <SumbreakDailyGame />;
}
