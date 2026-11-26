import { useLocale, useTranslations } from "next-intl";
import { LOCALE_META, type Locale } from "@/i18n/config";
import { REPOSITORY_URL } from "@/shared/platform/site";
import { PageHeader } from "@/shared/ui/page-header";
import { SiteFooter } from "@/shared/ui/site-footer";
import { LEGAL_UPDATED, legalContent } from "./content";

/** The privacy policy or the terms of use, in the page's language. The text itself is in ./en.ts and ./pt-br.ts. */
export function LegalScreen({ kind }: { kind: "privacy" | "terms" }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common.legal");
  const page = legalContent(locale)[kind];
  // The date is a calendar day, not a moment: formatted in UTC so the server and every browser print the same one.
  const updated = new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${LEGAL_UPDATED}T00:00:00Z`));
  return (
    <main className="mg-shell" data-testid={`legal-${kind}`}>
      <PageHeader title={page.short} />
      <article className="mg-prose w-full">
        <div>
          <p className="mg-prose-title">{page.title}</p>
          <p className="mg-prose-note">{t("updated", { date: updated })}</p>
        </div>
        {page.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.blocks.map((block, index) =>
              typeof block === "string" ? (
                <p key={index}>{block}</p>
              ) : (
                <ul key={index}>
                  {block.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
        <p className="mg-prose-note">
          <a href="https://brunosilva.io" target="_blank" rel="noopener noreferrer">
            brunosilva.io
          </a>
          {" · "}
          <a href={`${REPOSITORY_URL}/issues`} target="_blank" rel="noopener noreferrer">
            {t("issues")}
          </a>
        </p>
      </article>
      <SiteFooter current={kind} />
    </main>
  );
}
