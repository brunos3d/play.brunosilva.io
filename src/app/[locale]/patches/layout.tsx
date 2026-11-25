import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { gameMetadata } from "@/shared/platform/metadata";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  return gameMetadata((await params).locale, "patches");
}

export default async function PatchesLayout({ children, params }: Props) {
  setRequestLocale((await params).locale);
  return children;
}
