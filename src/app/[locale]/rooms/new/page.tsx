import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RoomSetup } from "@/shared/online/room-setup";
import { onlineMetadata } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return onlineMetadata((await params).locale, "roomNew", "/rooms/new");
}

export default async function NewRoomPage({ params }: Props) {
  setRequestLocale((await params).locale);
  return <RoomSetup />;
}
