import { setRequestLocale } from "next-intl/server";
import { WendDailyGame } from "@/games/wend/components/game/daily-game";

export default async function WendDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <WendDailyGame />;
}
