import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RoomScreen } from "@/shared/online/room-screen";
import { normalizeRoomCode } from "@/shared/online/rooms";
import { onlineMetadata } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string; code: string }> };

/**
 * A room's page is a shell: the browser loads the room. It is rendered for
 * each request and never stored, and only for something that can be a room
 * code. Stored per code, any made-up address under /rooms/ would have become
 * a page kept on the server, with the made-up text in it.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code } = await params;
  const room = normalizeRoomCode(code);
  // A room is private to the people who have its link, and gone in a day and a half, so no search engine is asked in.
  // Its canonical address is its own, because that is what a browser's Share menu sends: an invitation has to lead to
  // the room. The code in it is five letters of the room alphabet, never the text that was typed. An address that is
  // not a room is answered by the not-found page, with that page's own metadata.
  if (!room) return { robots: { index: false, follow: false } };
  return { ...(await onlineMetadata(locale, "room", `/rooms/${room}`)), robots: { index: false, follow: false } };
}

export default async function RoomPage({ params }: Props) {
  const { locale, code } = await params;
  const room = normalizeRoomCode(code);
  if (!room) notFound();
  setRequestLocale(locale);
  return <RoomScreen code={room} />;
}
