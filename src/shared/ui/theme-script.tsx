import { SETTINGS_STORAGE_KEY } from "@/shared/storage/settings";

/**
 * Sets `data-theme` on <html> before the first paint, so a player who chose
 * the dark theme never sees a light flash. It runs as a plain inline script in
 * <head>, ahead of React. The stylesheet has no `prefers-color-scheme` rule of
 * its own: "system" is resolved here, and ThemeSync keeps it current.
 *
 * The same logic lives in ./theme-sync.tsx. Keep the two in step.
 */
const SCRIPT = `(function(){try{var t="system";try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)})||"{}");if(s&&(s.theme==="light"||s.theme==="dark"))t=s.theme}catch(e){}if(t==="system")t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
