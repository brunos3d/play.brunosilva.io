import { LEGACY_WORD_LANGUAGE } from "@/i18n/game-language";
import type { Difficulty } from "@/shared/engine/difficulty";

/** Every game on the platform. The hub, the headers and the footers are built from this list. */
export const GAME_IDS = ["zip", "patches", "chess", "queens", "sumbreak", "wend", "termo"] as const;
export type GameId = (typeof GAME_IDS)[number];

/**
 * What a game is, apart from its text. Names, taglines, descriptions and the
 * label of a mistake are translated: they live in messages/<locale>/games.json
 * and are read with `useGameText` (shared/hooks/use-game-text.ts).
 */
export type GameMeta = {
  id: GameId;
  /** The game's name in English. Tools, tests and seeds use it. The interface shows the translated one. */
  name: string;
  /** Base route, without the locale. Daily lives here, practice at `${path}/practice`, seeded play at `${path}/play`. */
  path: string;
  /** False when every board has the same size, as in chess. The size is then left out of headers, results and the practice setup. */
  hasSizes: boolean;
  /**
   * Names shown in place of "easy", "medium", "hard" and "expert". Termo's
   * tiers are modes that players know by name: Termo, Dueto and Quarteto. They
   * are proper names, the same in every language. Seeds keep the four tiers
   * either way.
   */
  difficultyLabels?: Record<Difficulty, string>;
  /**
   * How the game depends on the game language (see i18n/game-language.ts).
   * "words": the puzzle itself is made of words, so each language has its own
   * puzzles and its own daily. "voice": the puzzle is the same, and only the
   * text spoken to the player changes, as with the chess coach.
   */
  language?: "words" | "voice";
};

/** The tier's own name, for a game that has them. Everywhere else the interface translates the tier. */
export const difficultyLabel = (game: GameMeta, difficulty: Difficulty): string => game.difficultyLabels?.[difficulty] ?? difficulty;

/**
 * The key a game's daily results are stored under for a game language, next to
 * the game id: nothing for the language the game first shipped in, the
 * language code otherwise. Only games made of words have one daily per language.
 */
export const dailyVariant = (game: GameMeta, language: string): string | undefined => (game.language === "words" && language !== LEGACY_WORD_LANGUAGE ? language : undefined);

export const PLATFORM_NAME = "Minigames";

export const GAMES: Record<GameId, GameMeta> = {
  zip: { id: "zip", name: "Zip", path: "/zip", hasSizes: true },
  patches: { id: "patches", name: "Patches", path: "/patches", hasSizes: true },
  chess: { id: "chess", name: "Chess", path: "/chess", hasSizes: false, language: "voice" },
  queens: { id: "queens", name: "Queens", path: "/queens", hasSizes: true },
  sumbreak: { id: "sumbreak", name: "Sumbreak", path: "/sumbreak", hasSizes: true },
  wend: { id: "wend", name: "Wend", path: "/wend", hasSizes: true, language: "words" },
  termo: {
    id: "termo",
    name: "Termo",
    path: "/termo",
    hasSizes: false,
    language: "words",
    // The same table as TERMO_MODE_NAMES in the game's engine. A unit test keeps the two in step.
    difficultyLabels: { easy: "Termo", medium: "Termo", hard: "Dueto", expert: "Quarteto" },
  },
};

export const GAME_LIST: GameMeta[] = GAME_IDS.map((id) => GAMES[id]);
