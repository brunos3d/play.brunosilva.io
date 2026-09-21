import { formatTime } from "@/shared/engine/clock";
import type { Difficulty } from "@/shared/engine/difficulty";
import type { PuzzleSpec, SeedCodec } from "@/shared/engine/seed-codec";

export type ShareableResult = {
  gameName: string;
  /** Daily puzzle number. Missing for practice puzzles. */
  dailyNumber?: number;
  difficulty: Difficulty;
  size: number;
  elapsedMs: number;
  hintsUsed: number;
  mistakesLabel: string;
  mistakes: number;
  /** Current daily streak. Only shown for daily puzzles. */
  streak?: number;
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Compact result block, the same shape for every game:
 *
 *   Zip #188
 *   00:48
 *   Hints: 0
 *   Backtracks: 1
 *   Streak: 12
 */
export function buildShareText(result: ShareableResult): string {
  const title =
    result.dailyNumber !== undefined
      ? `${result.gameName} #${result.dailyNumber}`
      : `${result.gameName} ${capitalize(result.difficulty)} ${result.size}x${result.size}`;
  const lines = [title, formatTime(result.elapsedMs), `Hints: ${result.hintsUsed}`, `${result.mistakesLabel}: ${result.mistakes}`];
  if (result.dailyNumber !== undefined && result.streak !== undefined) lines.push(`Streak: ${result.streak}`);
  return lines.join("\n");
}

/** `/zip/play?seed=ZIP:lucky:1:hard:8`. The seed carries version, difficulty and size. */
export function buildPlayPath(gamePath: string, codec: SeedCodec, spec: PuzzleSpec): string {
  return `${gamePath}/play?seed=${encodeURIComponent(codec.format(spec))}`;
}

export function buildPlayUrl(origin: string, gamePath: string, codec: SeedCodec, spec: PuzzleSpec): string {
  return `${origin.replace(/\/+$/, "")}${buildPlayPath(gamePath, codec, spec)}`;
}

/**
 * Reads a puzzle spec from a query string. Accepts the canonical seed, or a
 * bare seed with optional `difficulty`, `size` and `v` parameters.
 */
export function specFromSearchParams(codec: SeedCodec, params: URLSearchParams): PuzzleSpec | null {
  const seed = params.get("seed");
  if (seed === null || seed.trim() === "") return null;
  return codec.resolve({
    seed,
    difficulty: params.get("difficulty") ?? params.get("d"),
    size: params.get("size") ?? params.get("s"),
    version: params.get("v"),
  });
}
