import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RoomScreen } from "@/shared/online/room-screen";
import { onlineMetadata } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string; code: string }> };

/** No room is known at build time. Each one is rendered the first time it is asked for: the page is a shell, and the room itself is loaded by the browser. */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code } = await params;
  // A room is private to the people who have its link, and gone in a day and a half.
  return { ...(await onlineMetadata(locale, "room", `/rooms/${code}`)), robots: { index: false, follow: false } };
}

export default async function RoomPage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <RoomScreen code={code.toUpperCase()} />;
}
