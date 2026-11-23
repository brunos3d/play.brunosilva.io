"use client";

import { Fragment, type ReactNode, createContext, useCallback, useContext, useState } from "react";
import type { GameId } from "@/games/registry";
import { clearBoard } from "@/shared/storage/progress";
import { markReplay } from "@/shared/storage/replays";

const RetryContext = createContext<(() => void) | null>(null);

/** Starts the same puzzle over, or null where that is not offered. The game frame reads it. */
export const useRetry = (): (() => void) | null => useContext(RetryContext);

type Props = {
  game: GameId;
  puzzle: { id: string; seed: string };
  /** Practice only. A daily puzzle is played once. */
  enabled: boolean;
  children: ReactNode;
};

/**
 * Wraps a game's board so that a finished practice puzzle can be played again
 * from the start: same seed, same board, a fresh clock. "Try again" erases the
 * saved board, remembers that this puzzle is now a replay, and mounts the game
 * again, so every game gets the feature without knowing about it.
 */
export function PuzzleAttempts({ game, puzzle, enabled, children }: Props) {
  const [attempt, setAttempt] = useState(0);
  const { id, seed } = puzzle;
  const retry = useCallback(() => {
    void clearBoard(game, id).then(() => {
      markReplay(game, seed);
      setAttempt((count) => count + 1);
    });
  }, [game, id, seed]);

  return (
    <RetryContext.Provider value={enabled ? retry : null}>
      <Fragment key={attempt}>{children}</Fragment>
    </RetryContext.Provider>
  );
}
