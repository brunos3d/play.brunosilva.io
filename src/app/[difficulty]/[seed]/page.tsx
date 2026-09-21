import { redirect } from "next/navigation";
import { isDifficulty } from "@/shared/engine/difficulty";

/**
 * Old Zip links looked like /hard/42. They land on the new practice route with
 * the same number as the seed. The board is not the one the old link showed:
 * the old generator depended on a time limit, so it could not be reproduced.
 */
export default async function LegacyZipLink({ params }: { params: Promise<{ difficulty: string; seed: string }> }) {
  const { difficulty, seed } = await params;
  if (!isDifficulty(difficulty)) redirect("/");
  redirect(`/zip/play?seed=${encodeURIComponent(seed)}&difficulty=${difficulty}`);
}
