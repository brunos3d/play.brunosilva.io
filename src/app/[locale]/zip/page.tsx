import { setRequestLocale } from "next-intl/server";
import { ZipDailyGame } from "@/games/zip/components/game/daily-game";

export default async function ZipDailyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ZipDailyGame />;
}
