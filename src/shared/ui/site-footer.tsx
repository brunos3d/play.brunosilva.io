"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { REPOSITORY_URL } from "@/shared/platform/site";

type Target = "home" | "ranking" | "profile" | "privacy" | "terms";
const PATHS: Record<Target, string> = { home: "/", ranking: "/ranking", profile: "/profile", privacy: "/privacy", terms: "/terms" };
const ALL: readonly Target[] = ["home", "ranking", "profile", "privacy", "terms"];

/** The footer of a page that is not a game: the other places of the site, the two legal pages and the source. `current` is left out. */
export function SiteFooter({ current }: { current?: Target }) {
  const t = useTranslations("common.footer");
  const labels: Record<Target, string> = { home: t("allGames"), ranking: t("ranking"), profile: t("profile"), privacy: t("privacy"), terms: t("terms") };
  return (
    <footer className="mg-footer w-full pt-2 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-3 text-xs text-[var(--ink-faint)]">
      {ALL.filter((target) => target !== current).map((target) => (
        <Link key={target} href={PATHS[target]} prefetch={false} className="mg-text-link">
          {labels[target]}
        </Link>
      ))}
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className="mg-text-link">
        {t("github")}
      </a>
    </footer>
  );
}
