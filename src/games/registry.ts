import type { Difficulty } from "@/shared/engine/difficulty";

/** Every game on the platform. The hub, the headers and the footers are built from this list. */
export const GAME_IDS = ["zip", "patches", "chess", "queens", "sumbreak", "wend", "termo"] as const;
export type GameId = (typeof GAME_IDS)[number];

export type GameMeta = {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  /** Base route. Daily lives here, practice at `${path}/practice`, seeded play at `${path}/play`. */
  path: string;
  /** What the result screen calls a corrected mistake. */
  mistakesLabel: string;
  /** False when every board has the same size, as in chess. The size is then left out of headers, results and the practice setup. */
  hasSizes: boolean;
  /**
   * Names shown in place of "easy", "medium", "hard" and "expert". Termo's
   * tiers are modes that players know by name: Termo, Dueto and Quarteto.
   * Seeds keep the four tiers either way.
   */
  difficultyLabels?: Record<Difficulty, string>;
};

/** What the interface calls a tier of a game. */
export const difficultyLabel = (game: GameMeta, difficulty: Difficulty): string => game.difficultyLabels?.[difficulty] ?? difficulty;

export const PLATFORM_NAME = "Minigames";

export const GAMES: Record<GameId, GameMeta> = {
  zip: {
    id: "zip",
    name: "Zip",
    tagline: "One path, every cell",
    description: "Draw a single line through the numbers in order and fill the whole grid.",
    path: "/zip",
    mistakesLabel: "Backtracks",
    hasSizes: true,
  },
  patches: {
    id: "patches",
    name: "Patches",
    tagline: "One clue, one rectangle",
    description: "Cover the grid with rectangles so that each one holds exactly one clue.",
    path: "/patches",
    mistakesLabel: "Redraws",
    hasSizes: true,
  },
  chess: {
    id: "chess",
    name: "Chess",
    tagline: "Find the best move",
    description: "Solve a tactic from a generated game: give mate, win material or save the position, with a coach at your side.",
    path: "/chess",
    mistakesLabel: "Mistakes",
    hasSizes: false,
  },
  queens: {
    id: "queens",
    name: "Queens",
    tagline: "One queen per row, column and colour",
    description: "Place a queen in every row, column and coloured region so that no two queens touch.",
    path: "/queens",
    mistakesLabel: "Takebacks",
    hasSizes: true,
  },
  sumbreak: {
    id: "sumbreak",
    name: "Sumbreak",
    tagline: "Merge down to one tile",
    description: "Merge equal neighbours into their sum, in the right order, until a single tile is left.",
    path: "/sumbreak",
    mistakesLabel: "Missteps",
    hasSizes: true,
  },
  wend: {
    id: "wend",
    name: "Wend",
    tagline: "Hidden words, every letter",
    description: "Trace the hidden Portuguese words through neighbouring letters until every letter is used.",
    path: "/wend",
    mistakesLabel: "Erased",
    hasSizes: true,
  },
  termo: {
    id: "termo",
    name: "Termo",
    tagline: "Five letters, six guesses",
    description: "Guess the hidden Portuguese word. Every guess shows which letters are right, misplaced or absent.",
    path: "/termo",
    mistakesLabel: "Misses",
    hasSizes: false,
    // The same table as TERMO_MODE_NAMES in the game's engine. A unit test keeps the two in step.
    difficultyLabels: { easy: "Termo", medium: "Termo", hard: "Dueto", expert: "Quarteto" },
  },
};

export const GAME_LIST: GameMeta[] = GAME_IDS.map((id) => GAMES[id]);
