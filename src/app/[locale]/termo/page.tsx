import { setRequestLocale } from "next-intl/server";
import { TermoDailyGame } from "@/games/termo/components/game/daily-game";

export default async function TermoDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <TermoDailyGame />;
}
