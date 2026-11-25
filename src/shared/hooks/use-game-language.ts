"use client";

import { useLocale } from "next-intl";
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
