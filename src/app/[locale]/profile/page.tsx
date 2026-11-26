import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ProfileScreen } from "@/shared/online/profile-screen";
import { onlineMetadata } from "@/shared/platform/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return onlineMetadata((await params).locale, "profile", "/profile");
}

export default async function ProfilePage({ params }: Props) {
  setRequestLocale((await params).locale);
  return <ProfileScreen />;
}
