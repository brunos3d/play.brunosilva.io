"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { GAMES } from "@/games/registry";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { buildPlayPath } from "@/shared/platform/share-text";
import { GameFooter } from "@/shared/ui/game-footer";
import { GameHeader } from "@/shared/ui/game-header";
import { ShuffleIcon } from "@/shared/ui/icons";
import { GameLanguagePicker } from "@/shared/ui/practice-setup";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { TERMO_MODES } from "../../engine/config";
import { termoSeeds } from "../../engine/seed";

const GAME = GAMES.termo;

/**
 * Practice setup for Termo. The shared screen asks for a difficulty. Termo asks
 * for a mode instead, by the names players know: Termo, Dueto, Quarteto. Each
 * mode is one of the platform's tiers underneath, so seeds stay the same shape.
 * The language picker is the platform's game language setting.
 */
export function TermoPracticeSetup() {
  const router = useRouter();
  const { language } = useGameLanguage();
  const [mode, setMode] = useState(TERMO_MODES[0]);
  const [seed, setSeed] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A pasted canonical seed wins over the pickers, so shared seeds reproduce exactly. That includes its language.
    const token = seed.trim() === "" ? randomSeedToken() : seed;
    router.push(buildPlayPath(GAME.path, termoSeeds, termoSeeds.resolve({ seed: token, difficulty: mode.difficulty, version: termoSeeds.currentVersion, lang: language })));
  };

  return (
    <main className="mg-shell">
      <GameHeader game={GAME} mode="practice" />

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 mt-2">
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">Unlimited words from the same lists as the daily. Every word has five letters. Practice never touches your streak.</p>

        <GameLanguagePicker />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">Mode</legend>
          <div className="mg-segment">
            {TERMO_MODES.map((option) => (
              <button key={option.name} type="button" aria-pressed={mode.name === option.name} aria-label={`${option.name}: ${option.summary}`} onClick={() => setMode(option)} data-testid={`termo-mode-${option.name.toLowerCase()}`}>
                {option.name}
              </button>
            ))}
          </div>
          <span className="text-sm text-[var(--ink-soft)]" data-testid="termo-mode-summary">
            {mode.name}: {mode.summary}.
          </span>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">Seed (optional)</span>
          <input
            className="mg-field"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder={`A word, a number, or a shared ${termoSeeds.prefix}:… seed`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={96}
            data-testid="game-seed-input"
          />
          <span className="text-xs text-[var(--ink-faint)]">The same seed and mode always hide the same words.</span>
        </label>

        <button type="submit" className="mg-button" data-variant="primary" data-testid="game-start">
          <ShuffleIcon /> {seed.trim() === "" ? "Random puzzle" : "Play this seed"}
        </button>
      </form>

      <GameFooter current={GAME.id} />
    </main>
  );
}
