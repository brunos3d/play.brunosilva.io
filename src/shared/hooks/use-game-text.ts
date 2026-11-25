"use client";

import { useTranslations } from "next-intl";
import type { GameId, GameMeta } from "@/games/registry";
import type { Difficulty } from "@/shared/engine/difficulty";

export type GameText = {
  /** The name a game goes by in this locale: "Chess", "Xadrez". */
  name: (game: GameId) => string;
  tagline: (game: GameId) => string;
  description: (game: GameId) => string;
  /** What the result screen calls a corrected mistake: "Backtracks", "Redraws". */
  mistakes: (game: GameId) => string;
  /** The paragraph at the top of the practice setup. */
  practiceBlurb: (game: GameId) => string;
  /** What a tier is called: the translated difficulty, or the game's own name for it, as in Termo. */
  tier: (game: GameMeta, difficulty: Difficulty) => string;
};

/** The translated text of the games, from messages/<locale>/games.json. */
export function useGameText(): GameText {
  const t = useTranslations("games");
  const common = useTranslations("common");
  return {
    name: (game) => t(`${game}.name`),
    tagline: (game) => t(`${game}.tagline`),
    description: (game) => t(`${game}.description`),
    mistakes: (game) => t(`${game}.mistakes`),
    practiceBlurb: (game) => t(`${game}.practiceBlurb`),
    tier: (game, difficulty) => game.difficultyLabels?.[difficulty] ?? common(`difficulty.${difficulty}`),
  };
}
