import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { GAMES } from "@/games/registry";
import { WendSeedGame } from "@/games/wend/components/game/seed-game";
import { pageTitle } from "@/shared/platform/metadata";
import { GameLoading } from "@/shared/ui/game-loading";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return pageTitle((await params).locale, "play");
}

export default async function WendPlayPage({ params }: Props) {
  setRequestLocale((await params).locale);
  return (
    <Suspense fallback={<GameLoading game={GAMES.wend} />}>
      <WendSeedGame />
    </Suspense>
  );
}
