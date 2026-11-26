"use client";

import { useTranslations } from "next-intl";
import { PLATFORM_NAME } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import { PlatformIcon } from "./game-icons";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

/** Header of a page that is not a game: the platform's mark as the way home, the page's title, and the theme and language buttons. */
export function PageHeader({ title }: { title: string }) {
  const t = useTranslations("common.header");
  return (
    <header className="mg-header w-full flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 min-w-0">
        <Link href="/" prefetch={false} className="mg-home-link" aria-label={t("home", { game: PLATFORM_NAME })} data-testid="page-home">
          <PlatformIcon className="mg-home-mark flex-none rounded-[9px] shadow-[0_0_0_1.5px_var(--thread)]" />
        </Link>
        <h1 className="mg-display mg-page-title font-semibold min-w-0">{title}</h1>
      </div>
      <div className="mg-header-actions flex items-center flex-none">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
