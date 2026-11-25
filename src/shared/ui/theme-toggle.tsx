"use client";

import { useTranslations } from "next-intl";
import { useSettings } from "@/shared/hooks/use-settings";
import { MoonIcon, SunIcon } from "./icons";
import { useResolvedTheme } from "./theme-sync";

/**
 * One tap between the light and the dark theme. It shows the theme on screen
 * and switches to the other one. Going back to "follow the device" is in the
 * settings dialog.
 */
export function ThemeToggle() {
  const t = useTranslations("common.header");
  const { update } = useSettings();
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="mg-icon-button" aria-label={t(next === "dark" ? "themeToDark" : "themeToLight")} data-theme-now={theme} data-testid="theme-toggle" onClick={() => update({ theme: next })}>
      {theme === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
