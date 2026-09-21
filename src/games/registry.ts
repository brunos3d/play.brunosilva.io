/** Every game on the platform. The hub, the headers and the footers are built from this list. */
export const GAME_IDS = ["zip", "patches"] as const;
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
  },
  patches: {
    id: "patches",
    name: "Patches",
    tagline: "One clue, one rectangle",
    description: "Cover the grid with rectangles so that each one holds exactly one clue.",
    path: "/patches",
    mistakesLabel: "Redraws",
  },
};

export const GAME_LIST: GameMeta[] = GAME_IDS.map((id) => GAMES[id]);
