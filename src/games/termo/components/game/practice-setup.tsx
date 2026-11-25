"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { GAMES } from "@/games/registry";
import { useRouter } from "@/i18n/navigation";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGameText } from "@/shared/hooks/use-game-text";
import { buildPlayPath } from "@/shared/platform/share-text";
import { GameFooter } from "@/shared/ui/game-footer";
import { GameHeader } from "@/shared/ui/game-header";
import { ShuffleIcon } from "@/shared/ui/icons";
import { ChallengeLink, GameLanguagePicker } from "@/shared/ui/practice-setup";
import { randomSeedToken } from "@/shared/ui/random-seed";
import { TERMO_MODES } from "../../engine/config";
import { termoSeeds } from "../../engine/seed";
import { modeSummaryText } from "../../engine/text";

const GAME = GAMES.termo;

/**
 * Practice setup for Termo. The shared screen asks for a difficulty. Termo asks
 * for a mode instead, by the names players know: Termo, Dueto, Quarteto. Each
 * mode is one of the platform's tiers underneath, so seeds stay the same shape.
 * The language picker is the platform's game language setting.
 */
export function TermoPracticeSetup() {
  const t = useTranslations("termo");
  const common = useTranslations("common.practice");
  const text = useGameText();
  const router = useRouter();
  const { language } = useGameLanguage();
  const [mode, setMode] = useState(TERMO_MODES[0]);
  const [seed, setSeed] = useState("");
  const summary = (option: (typeof TERMO_MODES)[number]): string => t("practice.modeSummary", { name: option.name, summary: modeSummaryText(t, option.difficulty) });

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
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">{text.practiceBlurb(GAME.id)}</p>

        <GameLanguagePicker />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">{t("practice.mode")}</legend>
          <div className="mg-segment">
            {TERMO_MODES.map((option) => (
              <button key={option.name} type="button" aria-pressed={mode.name === option.name} aria-label={summary(option)} onClick={() => setMode(option)} data-testid={`termo-mode-${option.name.toLowerCase()}`}>
                {option.name}
              </button>
            ))}
          </div>
          <span className="text-sm text-[var(--ink-soft)]" data-testid="termo-mode-summary">
            {summary(mode)}
          </span>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{common("seed")}</span>
          <input
            className="mg-field"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder={common("seedPlaceholder", { prefix: termoSeeds.prefix })}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={96}
            data-testid="game-seed-input"
          />
          <span className="text-xs text-[var(--ink-faint)]">{t("practice.seedNote")}</span>
        </label>

        <button type="submit" className="mg-button" data-variant="primary" data-testid="game-start">
          <ShuffleIcon /> {common(seed.trim() === "" ? "random" : "playSeed")}
        </button>

        <ChallengeLink game={GAME.id} />
      </form>

      <GameFooter current={GAME.id} />
    </main>
  );
}
