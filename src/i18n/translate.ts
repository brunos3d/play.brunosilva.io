/**
 * A translator bound to one namespace: `t("hint.extend", { target: 4 })`.
 * The engines take one as an argument wherever they build a sentence, so they
 * stay free of React and of the i18n library. In a component it is what
 * `useTranslations("zip")` returns. In a test it comes from tests/i18n.ts.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string;
