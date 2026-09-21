"use client";

import { useEffect, useState } from "react";

export type Generated<T> = { key: string; puzzle: T; generationMs: number } | { key: string; error: string };

/**
 * Builds a puzzle after first paint, so the loading board shows up at once.
 * `key` is the canonical seed: a new key discards the old puzzle.
 */
export function useGeneratedPuzzle<T>(key: string, generate: () => T): Generated<T> | null {
  const [generated, setGenerated] = useState<Generated<T> | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const started = performance.now();
        const puzzle = generate();
        setGenerated({ key, puzzle, generationMs: performance.now() - started });
      } catch (error) {
        setGenerated({ key, error: error instanceof Error ? error.message : "The puzzle could not be built." });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
    // `key` fully determines what `generate` builds, so it is the only dependency needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return generated?.key === key ? generated : null;
}
