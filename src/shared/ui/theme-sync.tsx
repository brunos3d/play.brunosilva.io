"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSettings } from "@/shared/hooks/use-settings";
import type { Theme } from "@/shared/storage/settings";

export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";
/** Page background of each theme, for the browser's own chrome. The same values as --linen in theme.css. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#f6f1e7", dark: "#1d1a17" };

function subscribeToSystem(listener: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const systemIsDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

/** The theme on screen. "system" is resolved against the device, and follows it when it changes. Light on the server. */
export function useResolvedTheme(): ResolvedTheme {
  const { settings } = useSettings();
  const dark = useSyncExternalStore(subscribeToSystem, systemIsDark, () => false);
  return resolveTheme(settings.theme, dark);
}

export const resolveTheme = (theme: Theme, systemDark: boolean): ResolvedTheme => (theme === "system" ? (systemDark ? "dark" : "light") : theme);

/**
 * Keeps <html data-theme> and the browser's theme colour in step with the
 * setting and with the device. The first value is set by ThemeScript before
 * anything is painted. This takes over once React is running.
 */
export function ThemeSync() {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // The page ships one theme-color per colour scheme. A theme picked by hand overrides both.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = THEME_COLOR[theme];
  }, [theme]);
  return null;
}
