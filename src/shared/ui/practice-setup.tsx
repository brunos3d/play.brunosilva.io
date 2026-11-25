"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import type { GameMeta } from "@/games/registry";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { useRouter } from "@/i18n/navigation";
import { DIFFICULTIES, type Difficulty } from "@/shared/engine/difficulty";
import type { SeedCodec } from "@/shared/engine/seed-codec";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useGameText } from "@/shared/hooks/use-game-text";
import { buildPlayPath } from "@/shared/platform/share-text";
import { LocaleFlag } from "./flags";
import { GameFooter } from "./game-footer";
import { GameHeader } from "./game-header";
import { ShuffleIcon } from "./icons";
import { randomSeedToken } from "./random-seed";

type Props = { game: GameMeta; codec: SeedCodec };

/** The language of the words, for a game made of words. It is the platform's game language setting, shown where a puzzle is about to be picked. */
export function GameLanguagePicker() {
  const t = useTranslations("common.practice");
  const { language, choose } = useGameLanguage();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">{t("language")}</legend>
      <div className="mg-segment" data-testid="game-language">
        {LOCALES.map((option) => (
          <button key={option} type="button" aria-pressed={language === option} data-value={option} lang={LOCALE_META[option].htmlLang} className="mg-segment-flag" onClick={() => choose(option)}>
            <LocaleFlag locale={option} className="mg-flag" /> {LOCALE_META[option].nativeLabel}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Pickers for difficulty, board size and seed. The same screen serves every game. */
export function PracticeSetup({ game, codec }: Props) {
  const t = useTranslations("common.practice");
  const text = useGameText();
  const router = useRouter();
  const { language } = useGameLanguage();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [size, setSize] = useState<number | null>(null);
  const [seed, setSeed] = useState("");
  const sizes: (number | null)[] = [null, ...Array.from({ length: codec.maxSize - codec.minSize + 1 }, (_, index) => codec.minSize + index)];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A pasted canonical seed wins over the pickers, so shared seeds reproduce exactly. That includes its language.
    const token = seed.trim() === "" ? randomSeedToken() : seed;
    router.push(buildPlayPath(game.path, codec, codec.resolve({ seed: token, difficulty, size, version: codec.currentVersion, lang: language })));
  };

  return (
    <main className="mg-shell">
      <GameHeader game={game} mode="practice" />

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 mt-2">
        <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">{text.practiceBlurb(game.id)}</p>

        {game.language === "words" && <GameLanguagePicker />}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">{t("difficulty")}</legend>
          <div className="mg-segment">
            {DIFFICULTIES.map((option) => (
              <button key={option} type="button" aria-pressed={difficulty === option} className="capitalize" data-value={option} onClick={() => setDifficulty(option)}>
                {text.tier(game, option)}
              </button>
            ))}
          </div>
        </fieldset>

        {game.hasSizes && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)] mb-2">{t("size")}</legend>
            <div className="mg-segment">
              {sizes.map((option) => (
                <button key={option ?? "auto"} type="button" aria-pressed={size === option} aria-label={option === null ? t("autoSize") : t("sizeOption", { size: option })} onClick={() => setSize(option)}>
                  {option ?? t("auto")}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-[var(--ink-soft)]">{t("seed")}</span>
          <input
            className="mg-field"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder={t("seedPlaceholder", { prefix: codec.prefix })}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={96}
            data-testid="game-seed-input"
          />
          <span className="text-xs text-[var(--ink-faint)]">{t(game.hasSizes ? "seedNoteSized" : "seedNote")}</span>
        </label>

        <button type="submit" className="mg-button" data-variant="primary" data-testid="game-start">
          <ShuffleIcon /> {t(seed.trim() === "" ? "random" : "playSeed")}
        </button>
      </form>

      <GameFooter current={game.id} />
    </main>
  );
}
