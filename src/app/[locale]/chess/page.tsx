import { setRequestLocale } from "next-intl/server";
import { ChessDailyGame } from "@/games/chess/components/game/daily-game";

export default async function ChessDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ChessDailyGame />;
}
