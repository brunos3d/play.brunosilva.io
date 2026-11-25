import { setRequestLocale } from "next-intl/server";
import { QueensDailyGame } from "@/games/queens/components/game/daily-game";

export default async function QueensDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <QueensDailyGame />;
}
