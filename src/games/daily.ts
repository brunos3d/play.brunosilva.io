import { getChessDailyInfo } from "@/games/chess/engine/daily";
import { chessPuzzleId } from "@/games/chess/engine/generator";
import { getDailyInfo as getPatchesDaily } from "@/games/patches/engine/daily/schedule";
import { patchesPuzzleId } from "@/games/patches/engine/generator/generate";
import { getQueensDailyInfo } from "@/games/queens/engine/daily";
import { queensPuzzleId } from "@/games/queens/engine/generator";
import type { GameId } from "@/games/registry";
import { getSumbreakDailyInfo } from "@/games/sumbreak/engine/daily";
import { sumbreakPuzzleId } from "@/games/sumbreak/engine/generator";
import { getTermoDailyInfo } from "@/games/termo/engine/daily";
import { termoPuzzleId } from "@/games/termo/engine/seed";
import { getWendDailyInfo } from "@/games/wend/engine/daily";
import { wendPuzzleId } from "@/games/wend/engine/seed";
import { getZipDailyInfo } from "@/games/zip/engine/daily";
import { zipPuzzleId } from "@/games/zip/engine/generator";
import { type GameLanguage, LEGACY_WORD_LANGUAGE } from "@/i18n/game-language";
import type { DailyInfo } from "@/shared/engine/daily";

/**
 * The daily puzzle of every game, by id: what it is on a date, and the id its
 * board is stored under. The hub, the sync between a player's devices and the
 * server all ask the same table, so they cannot disagree about which puzzle a
 * date holds.
 *
 * `info` takes the game language. Only the games made of words read it: they
 * have one daily puzzle per language. Those two keep their word lists out of
 * here: the daily schedule and the puzzle id live in modules that do not
 * import the generator.
 */
export const DAILY_GAMES: Record<GameId, { info: (date: string, language: GameLanguage) => DailyInfo; puzzleId: (seed: string) => string }> = {
  zip: { info: (date) => getZipDailyInfo(date), puzzleId: zipPuzzleId },
  patches: { info: (date) => getPatchesDaily(date), puzzleId: patchesPuzzleId },
  chess: { info: (date) => getChessDailyInfo(date), puzzleId: chessPuzzleId },
  queens: { info: (date) => getQueensDailyInfo(date), puzzleId: queensPuzzleId },
  sumbreak: { info: (date) => getSumbreakDailyInfo(date), puzzleId: sumbreakPuzzleId },
  wend: { info: getWendDailyInfo, puzzleId: wendPuzzleId },
  termo: { info: getTermoDailyInfo, puzzleId: termoPuzzleId },
};

/** The daily a stored variant names: "" is the language the game first shipped in. */
export const dailyInfoOf = (game: GameId, date: string, variant: string): DailyInfo => DAILY_GAMES[game].info(date, (variant || LEGACY_WORD_LANGUAGE) as GameLanguage);
