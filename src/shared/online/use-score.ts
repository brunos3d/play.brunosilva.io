"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { online } from "./api";
import { randomAvatarSeed, randomPlayerName } from "./names";
import type { ScoreSubmission } from "./types";
import { refreshPlayer } from "./use-player";

/**
 * Sends a finished daily puzzle to the ranking and resolves with the points it
 * earned, or with null when it did not count: the puzzle already had a score,
 * the device is offline, or the site runs without a database. A failure never
 * reaches the player. The result on the device is the one that matters, and
 * the ranking is an extra on top of it.
 *
 * A device without a player gets one here, with a generated name and avatar
 * in the page's language.
 */
export function useScoreSubmission(): (score: ScoreSubmission) => Promise<number | null> {
  const locale = useLocale();
  return useCallback(
    async (score: ScoreSubmission) => {
      try {
        const answer = await online.submitScore(score, { name: randomPlayerName(locale), avatar: randomAvatarSeed(), locale });
        // The submission may have just created this device's player. The rest of the page learns about it here.
        refreshPlayer();
        return answer.recorded ? answer.points : null;
      } catch {
        return null;
      }
    },
    [locale],
  );
}
