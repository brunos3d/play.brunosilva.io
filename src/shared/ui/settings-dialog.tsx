"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { useGameLanguage } from "@/shared/hooks/use-game-language";
import { useSwitchLocale } from "@/shared/hooks/use-switch-locale";
import { usePlayer } from "@/shared/online/use-player";
import { supportsHaptics } from "@/shared/platform/haptics";
import { promptInstall, useInstall } from "@/shared/platform/install";
import { disablePush, enablePush, readPushState, requestPushPermission, usePushState } from "@/shared/platform/push-client";
import { type Settings, THEMES } from "@/shared/storage/settings";
import { PLATFORM_NAME } from "@/games/registry";
import { Dialog } from "./dialog";
import { LocaleFlag } from "./flags";
import { ShareIcon } from "./icons";

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

function Toggle({ label, hint, checked, disabled, testId, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; testId?: string; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-sm text-[var(--ink-soft)]">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="mg-switch" disabled={disabled} onClick={() => onChange(!checked)} data-testid={testId} />
    </div>
  );
}

/**
 * Reminders of a streak about to end, for this device. The switch is only
 * there where it can work: a browser with notifications, a site with its
 * keys, and on iOS the installed app. A device that was told "no" in the
 * browser's own prompt says so, since only the browser's settings can undo it.
 */
function Reminders({ open }: { open: boolean }) {
  const t = useTranslations("settings.reminders");
  const locale = useLocale();
  const { ensure } = usePlayer();
  // Shared with the offer on the home screen, so the two always agree.
  const state = usePushState();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) void readPushState();
  }, [open]);
  if (state === null || state === "unsupported") return null;
  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (!on) await disablePush();
      // The browser's prompt first, while the tap still counts as one. Then the player: a reminder is about a player's
      // streak, so there has to be one to remind, and creating it can take a moment.
      else if ((await requestPushPermission()) === "granted") {
        await ensure();
        await enablePush(locale);
      }
    } catch {
      await readPushState();
    }
    setBusy(false);
  };
  return <Toggle label={t("label")} hint={t(state === "blocked" ? "blocked" : "hint")} checked={state === "on"} disabled={busy || state === "blocked"} testId="settings-reminders" onChange={(on) => void toggle(on)} />;
}

/** The way to install the site as an app, for a device that can and has not. */
function Install() {
  const t = useTranslations("common.offers");
  const install = useInstall();
  if (install.kind === "none") return null;
  return (
    <div className="py-3 flex flex-col gap-2" data-testid="settings-install">
      <div>
        <div className="font-semibold">{t("install.title", { app: PLATFORM_NAME })}</div>
        <div className="text-sm text-[var(--ink-soft)]">
          {install.kind === "ios"
            ? t.rich("install.ios", { share: () => <ShareIcon className="inline-block w-4 h-4 align-[-3px] text-[var(--ink)]" />, strong: (chunks) => <strong className="font-semibold text-[var(--ink)]">{chunks}</strong> })
            : t("install.body")}
        </div>
      </div>
      {install.kind === "prompt" && (
        <button type="button" className="mg-button" onClick={() => void promptInstall()}>
          {t("install.accept")}
        </button>
      )}
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
        <Reminders open={open} />
        <Install />
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
