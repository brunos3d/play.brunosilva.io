"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/shared/ui/page-header";

/** What an online page shows on a deployment without a database: the reason, and the way back to the games, which all work without one. */
export function OnlineUnavailable({ title }: { title: string }) {
  const t = useTranslations("online");
  return (
    <main className="mg-shell">
      <PageHeader title={title} />
      <div className="mg-card text-center" role="alert">
        <p className="font-semibold">{t("unavailable.title")}</p>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{t("unavailable.body")}</p>
        <Link href="/" prefetch={false} className="mg-button">
          {t("room.home")}
        </Link>
      </div>
    </main>
  );
}
