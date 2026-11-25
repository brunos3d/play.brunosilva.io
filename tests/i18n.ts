import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTranslator } from "use-intl/core";
import { LOCALES, type Locale } from "@/i18n/config";
import { NAMESPACES, type Namespace } from "@/i18n/messages";
import type { Translate } from "@/i18n/translate";

/** The messages of one namespace, straight from messages/<locale>/<namespace>.json. */
export function messagesOf(locale: Locale, namespace: Namespace): Record<string, unknown> {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../messages/${locale}/${namespace}.json`, import.meta.url)), "utf8")) as Record<string, unknown>;
}

/**
 * The translator a component gets from `useTranslations(namespace)`, for tests
 * and command-line tools: `const t = translator("zip")`. English unless asked
 * otherwise. A missing key throws, so a test never passes on a key that does
 * not exist.
 */
export function translator(namespace: Namespace, locale: Locale = "en"): Translate {
  const t = createTranslator({
    locale,
    namespace,
    messages: { [namespace]: messagesOf(locale, namespace) },
    onError: (error) => {
      throw error;
    },
  });
  return (key, values) => t(key as never, values as never) as string;
}

/** Every leaf key of a message file: "hint.extend", "status.solved". */
export function messageKeys(messages: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => (typeof value === "object" && value !== null ? messageKeys(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]));
}

export { LOCALES, NAMESPACES };
