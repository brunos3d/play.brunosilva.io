"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { useSwitchLocale } from "@/shared/hooks/use-switch-locale";
import { LocaleFlag } from "./flags";
import { CheckIcon } from "./icons";

/**
 * The interface language, as a small drop-down in the header: the flag of the
 * current locale opens a menu with every locale by its own name. Picking one
 * reloads the same page in that language.
 */
export function LocaleSwitcher() {
  const t = useTranslations("common.switcher");
  const { locale, pending, switchTo } = useSwitchLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape closes the menu and nothing else: a game underneath must not read it.
      event.stopPropagation();
      setOpen(false);
      root.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="mg-locale" data-testid="locale-switcher">
      <button
        type="button"
        className="mg-icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t("current", { language: LOCALE_META[locale].nativeLabel })}
        aria-busy={pending || undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <LocaleFlag locale={locale} className="mg-flag" />
      </button>
      {open && (
        <div id={menuId} className="mg-menu" role="menu" aria-label={t("label")}>
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === locale}
              lang={LOCALE_META[option].htmlLang}
              className="mg-menu-item"
              data-testid={`locale-option-${option}`}
              onClick={() => {
                setOpen(false);
                switchTo(option);
              }}
            >
              <LocaleFlag locale={option} className="mg-flag" />
              <span className="flex-1 text-left">{LOCALE_META[option].nativeLabel}</span>
              {option === locale && <CheckIcon className="w-4 h-4 text-[var(--valid)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
