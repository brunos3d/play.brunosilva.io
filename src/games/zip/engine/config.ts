import type { Difficulty } from "@/shared/engine/difficulty";

export type ZipTier = {
  /** Board edge lengths the tier picks from when no size is requested. */
  sizes: readonly number[];
  /**
   * Numbered cells as a share of all cells, [min, max]. Numbers are what guide
   * the player, so harder tiers get fewer of them on bigger boards.
   */
  checkpointDensity: readonly [number, number];
  /** Upper bound on walls, as a share of all cells. A board that needs more is thrown away. */
  maxWallShare: number;
};

export const MIN_CHECKPOINTS = 3;

export const ZIP_TIERS: Record<Difficulty, ZipTier> = {
  easy: { sizes: [5, 6], checkpointDensity: [0.16, 0.22], maxWallShare: 0.3 },
  medium: { sizes: [6, 7], checkpointDensity: [0.12, 0.16], maxWallShare: 0.3 },
  hard: { sizes: [7, 8], checkpointDensity: [0.09, 0.12], maxWallShare: 0.32 },
  expert: { sizes: [8], checkpointDensity: [0.07, 0.095], maxWallShare: 0.34 },
};
