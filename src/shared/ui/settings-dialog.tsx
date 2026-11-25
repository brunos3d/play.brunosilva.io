"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useSwitchLocale } from "@/shared/hooks/use-switch-locale";
import { supportsHaptics } from "@/shared/platform/haptics";
import { type Settings, THEMES } from "@/shared/storage/settings";
import { Dialog } from "./dialog";
import { LocaleFlag } from "./flags";

type Props = {
  open: boolean;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  /** Shown inside a game, where there is a tutorial to replay. */
  onReplayTutorial?: () => void;
  /** Offers the game language. On for the hub and for the games that depend on it: Termo, Wend and Chess. */
  showGameLanguage?: boolean;
};

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-sm text-[var(--ink-soft)]">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="mg-switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

/** A setting with a few named values, picked from a segmented row. */
function Choice({ label, hint, testId, children }: { label: string; hint?: string; testId: string; children: ReactNode }) {
  return (
    <div className="py-3 flex flex-col gap-2">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-sm text-[var(--ink-soft)]">{hint}</div>}
      </div>
      <div className="mg-segment" role="group" aria-label={label} data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

/**
 * Settings are shared by every game on the platform. Two of them are about
 * language and are independent: the interface language changes the page's
 * locale, and the game language changes the words and the coach's voice.
 */
export function SettingsDialog({ open, settings, onChange, onClose, onReplayTutorial, showGameLanguage = false }: Props) {
  const t = useTranslations("settings");
  const { locale, switchTo } = useSwitchLocale();
  const game = useGameLanguage();

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-settings">
      <div className="divide-y divide-[var(--thread)]">
        <Choice label={t("theme.label")} hint={t("theme.hint")} testId="settings-theme">
          {THEMES.map((theme) => (
            <button key={theme} type="button" aria-pressed={settings.theme === theme} data-value={theme} onClick={() => onChange({ theme })}>
              {t(`theme.${theme}`)}
            </button>
          ))}
        </Choice>
        <Choice label={t("interface.label")} hint={t("interface.hint")} testId="settings-interface-language">
          {LOCALES.map((option) => (
            <button key={option} type="button" aria-pressed={locale === option} data-value={option} lang={LOCALE_META[option].htmlLang} className="mg-segment-flag" onClick={() => switchTo(option)}>
              <LocaleFlag locale={option} className="mg-flag" /> {LOCALE_META[option].shortLabel}
            </button>
          ))}
        </Choice>
        {showGameLanguage && (
          <Choice label={t("gameLanguage.label")} hint={t("gameLanguage.hint")} testId="settings-game-language">
            {LOCALES.map((option) => (
              <button key={option} type="button" aria-pressed={game.language === option} data-value={option} lang={LOCALE_META[option].htmlLang} className="mg-segment-flag" onClick={() => game.choose(option)}>
                <LocaleFlag locale={option} className="mg-flag" /> {LOCALE_META[option].shortLabel}
              </button>
            ))}
          </Choice>
        )}
        <Toggle label={t("sound.label")} hint={t("sound.hint")} checked={settings.sound} onChange={(sound) => onChange({ sound })} />
        <Toggle label={t("vibration.label")} hint={supportsHaptics() ? t("vibration.supported") : t("vibration.unsupported")} checked={settings.haptics} onChange={(haptics) => onChange({ haptics })} />
      </div>
      {onReplayTutorial && (
        <button type="button" className="mg-button w-full mt-4" onClick={onReplayTutorial}>
          {t("replay")}
        </button>
      )}
      <p className="mt-4 text-xs text-[var(--ink-faint)] leading-relaxed">{t("note")}</p>
    </Dialog>
  );
}
