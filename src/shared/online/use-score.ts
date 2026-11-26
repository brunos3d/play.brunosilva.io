"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { OnlineError, online } from "./api";
import { adoptRecord, queueSubmission } from "./daily-sync";
import { randomAvatarSeed, randomPlayerName } from "./names";
import type { ScoreAnswer, ScoreSubmission } from "./types";
import { refreshPlayer } from "./use-player";

/**
 * Tells the server a daily puzzle is closed: solved, revealed or lost. The
 * answer says whether this close is the one that counts and how the daily
 * stands for the player, which the device then stores as its own result. It
 * resolves with null when the server could not be asked: the device is
 * offline, or the site runs without a database. A failure never reaches the
 * player. A close that could not be sent is kept and sent with the next sync.
 *
 * A solve gives a device without a player one, with a generated name and
 * avatar in the page's language.
 */
export function useScoreSubmission(): (score: ScoreSubmission) => Promise<ScoreAnswer | null> {
  const locale = useLocale();
  return useCallback(
    async (score: ScoreSubmission) => {
      try {
        const answer = await online.submitScore(score, { name: randomPlayerName(locale), avatar: randomAvatarSeed(), locale });
        // The submission may have just created this device's player. The rest of the page learns about it here.
        refreshPlayer();
        if (answer.record && answer.player) await adoptRecord(answer.record, answer.player);
        // The server keeps a board only for a player it already knew, and this close may be the one that made the player.
        // Now that there is one, the board goes again, and other devices do not have to wait for this one's next sync.
        if (answer.recorded && score.board !== undefined && answer.record?.board === null) void online.submitScore(score).catch(() => undefined);
        return answer;
      } catch (error) {
        const lost = !(error instanceof OnlineError) || error.status === 0 || error.status >= 500;
        if (lost && !(error instanceof OnlineError && error.code === "unavailable")) await queueSubmission(score).catch(() => undefined);
        return null;
      }
    },
    [locale],
  );
}
