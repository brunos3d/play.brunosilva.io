"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";
import type { Locale } from "@/i18n/config";
import { type GameLanguage, effectiveGameLanguage } from "@/i18n/game-language";
import { useHydrated, useSettings } from "./use-settings";

/**
 * The language games are played in: the words of Termo and Wend, the voice of
 * the chess coach. It is the player's own choice, kept on the device, and the
 * interface locale until they make one.
 *
 * `ready` is false during server rendering and hydration, when the stored
 * choice is not known yet. A game that builds its puzzle from the language
 * waits for it, so it never builds one language and then swaps to the other.
 */
export function useGameLanguage(): { language: GameLanguage; ready: boolean; choose: (language: GameLanguage) => void } {
  const locale = useLocale() as Locale;
  const { settings, update } = useSettings();
  const ready = useHydrated();
  return { language: effectiveGameLanguage(settings.gameLanguage, locale), ready, choose: (gameLanguage) => update({ gameLanguage }) };
}

/**
 * Runs `onChange` when the player picks another game language while the page
 * is open. It does not run for the language the page opened with.
 *
 * A seeded puzzle keeps the language of its seed, so a page showing one uses
 * this to move on to a new puzzle in the language just picked. Without it the
 * setting would seem to do nothing until the next puzzle.
 */
export function useGameLanguageChange(onChange: (language: GameLanguage) => void): void {
  const { language, ready } = useGameLanguage();
  const seen = useRef<GameLanguage | null>(null);
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!ready) return;
    const before = seen.current;
    seen.current = language;
    if (before !== null && before !== language) handler.current(language);
  }, [language, ready]);
}
