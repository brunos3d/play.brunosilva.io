import type { Locale } from "./config";

/**
 * Messages are split by namespace, one JSON file each, in messages/<locale>/.
 * Adding a namespace: create the file in every locale and add its name here.
 * Adding a locale: create its folder with the same files and add it to config.ts.
 *
 * - common: what every game shares (header, controls, dialogs, result screen).
 * - games: names, taglines and descriptions of the games.
 * - metadata: page titles and descriptions.
 * - one namespace per game for its own text.
 */
export const NAMESPACES = ["common", "games", "hub", "settings", "metadata", "zip", "patches", "chess", "queens", "sumbreak", "wend", "termo"] as const;

export type Namespace = (typeof NAMESPACES)[number];
export type Messages = Record<Namespace, Record<string, unknown>>;

export async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const loaded = (await import(`../../messages/${locale}/${namespace}.json`)) as { default: Record<string, unknown> };
      return [namespace, loaded.default] as const;
    }),
  );
  return Object.fromEntries(entries) as Messages;
}
