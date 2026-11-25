import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation";
import { isDifficulty } from "@/shared/engine/difficulty";

/**
 * Every path no route answers.
 *
 * Old Zip links looked like /hard/42. They land on the practice route with the
 * same number as the seed. The board is not the one the old link showed: the
 * old generator depended on a time limit, so it could not be reproduced. Any
 * other two-part path goes to the hub, as it did before.
 *
 * Everything else is a missing page, shown by not-found.tsx in the visitor's
 * language.
 */
export default async function UnmatchedPath({ params }: { params: Promise<{ locale: string; rest: string[] }> }) {
  const { locale, rest } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  if (rest.length !== 2) notFound();
  const [difficulty, seed] = rest;
  if (!isDifficulty(difficulty)) redirect({ href: "/", locale });
  redirect({ href: `/zip/play?seed=${encodeURIComponent(seed)}&difficulty=${difficulty}`, locale });
}
