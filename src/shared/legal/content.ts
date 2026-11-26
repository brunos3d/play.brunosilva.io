import type { Locale } from "@/i18n/config";
import { en } from "./en";
import { ptBr } from "./pt-br";

/**
 * The privacy policy and the terms of use. They are long texts with a fixed
 * structure, so each language is a TypeScript module of its own instead of a
 * tree of message keys: the type below keeps the two languages in the same
 * shape, and a section reads top to bottom as it will on the page.
 *
 * These pages describe what the code does. When the code changes what it
 * stores (a new cookie, a new table, a new provider), the texts in both
 * languages change with it, and so does `LEGAL_UPDATED`.
 */

/** A paragraph, or a list of short items. */
export type LegalBlock = string | { list: readonly string[] };

export type LegalSection = { heading: string; blocks: readonly LegalBlock[] };

/** `short` is the page's title in its header, where a long one does not fit a phone. `title` opens the text. */
export type LegalDocument = { short: string; title: string; intro: readonly string[]; sections: readonly LegalSection[] };

export type LegalContent = { privacy: LegalDocument; terms: LegalDocument };

/** The day the texts last changed, shown at the top of both pages. */
export const LEGAL_UPDATED = "2026-11-26";

const CONTENT: Record<Locale, LegalContent> = { en, "pt-br": ptBr };

export const legalContent = (locale: Locale): LegalContent => CONTENT[locale];
