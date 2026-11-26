import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * An address that leads nowhere has no canonical address and no versions in
 * other languages. Without this it would inherit the home page's, and tell
 * search engines and Share menus that it is the home page.
 */
export const metadata: Metadata = { alternates: {} };

/** A page that does not exist, in the visitor's language. */
export default async function NotFound() {
  const t = await getTranslations("common.notFound");
  return (
    <main className="mg-shell" style={{ justifyContent: "center", textAlign: "center" }}>
      <h1 className="mg-display text-[28px] font-semibold leading-tight">{t("title")}</h1>
      <p className="text-[15px] leading-relaxed text-[var(--ink-soft)]">{t("body")}</p>
      <Link href="/" className="mg-button" data-variant="primary">
        {t("home")}
      </Link>
    </main>
  );
}
