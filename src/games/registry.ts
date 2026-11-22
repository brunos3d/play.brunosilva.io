/** Every game on the platform. The hub, the headers and the footers are built from this list. */
export const GAME_IDS = ["zip", "patches", "chess", "queens"] as const;
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
};

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
};

export const GAME_LIST: GameMeta[] = GAME_IDS.map((id) => GAMES[id]);
