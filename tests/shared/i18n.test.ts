import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { GAMES, dailyVariant } from "@/games/registry";
import { DEFAULT_LOCALE, LOCALES, localeOfPath, localizePath } from "@/i18n/config";
import { acceptedLanguages, detectLocale } from "@/i18n/detect";
import { effectiveGameLanguage } from "@/i18n/game-language";
import { getDailyInfo } from "@/shared/engine/daily";
import { createSeedCodec } from "@/shared/engine/seed-codec";
import { computeStreak } from "@/shared/engine/streak";
import { isPagePath, resolveHostRedirect } from "@/shared/platform/site";
import { resetIdbConnection } from "@/shared/storage/idb";
import { loadDailyResult, loadDailyResults, saveDailyResult, streakDates } from "@/shared/storage/progress";
import { NAMESPACES, messageKeys, messagesOf } from "../i18n";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("locale detection", () => {
  it("lets the cookie win over the country and the browser", () => {
    expect(detectLocale(headers({ "x-vercel-ip-country": "BR", "accept-language": "pt-BR" }), "en")).toBe("en");
    expect(detectLocale(headers({ "x-vercel-ip-country": "US", "accept-language": "en-US" }), "pt-br")).toBe("pt-br");
  });

  it("starts a visitor in Brazil in Portuguese, whatever the browser says", () => {
    expect(detectLocale(headers({ "x-vercel-ip-country": "BR", "accept-language": "en-US,en;q=0.9" }))).toBe("pt-br");
    expect(detectLocale(headers({ "x-vercel-ip-country": "br" }))).toBe("pt-br");
  });

  it("reads the browser's languages in order of preference", () => {
    expect(detectLocale(headers({ "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8" }))).toBe("pt-br");
    expect(detectLocale(headers({ "accept-language": "pt-PT" }))).toBe("pt-br");
    expect(detectLocale(headers({ "accept-language": "en-GB,en;q=0.9,pt;q=0.5" }))).toBe("en");
    expect(detectLocale(headers({ "accept-language": "fr-FR,pt;q=0.4,en;q=0.9" }))).toBe("en");
    expect(detectLocale(headers({ "accept-language": "de,pt;q=0.6,en;q=0.3" }))).toBe("pt-br");
    expect(acceptedLanguages("en;q=0.2, pt-BR, *;q=0.1, fr;q=0")).toEqual(["pt-br", "en"]);
  });

  it("falls back to English on anything it cannot use", () => {
    expect(detectLocale(headers({}))).toBe(DEFAULT_LOCALE);
    expect(detectLocale(headers({ "accept-language": "ja,zh;q=0.9", "x-vercel-ip-country": "JP" }), "klingon")).toBe("en");
    expect(detectLocale(headers({ "accept-language": ";;;q=abc," }))).toBe("en");
  });
});

describe("localized paths", () => {
  it("puts the locale in front of a path and reads it back", () => {
    expect(localizePath("pt-br", "/")).toBe("/pt-br");
    expect(localizePath("en", "/zip/play")).toBe("/en/zip/play");
    expect(localeOfPath("/pt-br/zip")).toBe("pt-br");
    expect(localeOfPath("/en")).toBe("en");
    expect(localeOfPath("/zip")).toBeNull();
    expect(localeOfPath("/english/zip")).toBeNull();
  });

  it("tells pages from files, so only pages get a locale", () => {
    for (const path of ["/", "/zip", "/zip/play", "/pt-br/termo", "/hard/42", "/hard/v1.5"]) expect(isPagePath(path), path).toBe(true);
    for (const path of ["/sw.js", "/manifest.webmanifest", "/icons/zip.svg", "/og/home.png", "/_next/data/x", "/favicon.ico"]) expect(isPagePath(path), path).toBe(false);
  });

  it("keeps a locale that a shortcut domain was asked for", () => {
    expect(resolveHostRedirect("zip.brunosilva.io", "/pt-br/zip")).toBe("https://play.brunosilva.io/pt-br/zip");
    expect(resolveHostRedirect("zip.brunosilva.io", "/en")).toBe("https://play.brunosilva.io/en");
  });
});

describe("seeds with a language", () => {
  const words = createSeedCodec({ prefix: "WORDS", currentVersion: 1, supportedVersions: [1], minSize: 5, maxSize: 8, languages: { supported: LOCALES, legacy: "pt-br" } });
  const plain = createSeedCodec({ prefix: "PLAIN", currentVersion: 1, supportedVersions: [1], minSize: 5, maxSize: 8 });

  it("leaves the legacy language out, so old seeds are unchanged", () => {
    expect(words.format({ token: "lucky", version: 1, difficulty: "hard" })).toBe("WORDS:lucky:1:hard");
    expect(words.format({ token: "lucky", version: 1, difficulty: "hard", lang: "pt-br" })).toBe("WORDS:lucky:1:hard");
    expect(words.parse("WORDS:lucky:1:hard")).toEqual({ token: "lucky", version: 1, difficulty: "hard" });
    expect(words.languageOf(words.parse("WORDS:lucky:1:hard")!)).toBe("pt-br");
    expect(words.rngKey({ token: "lucky", version: 1, difficulty: "hard" })).toBe("WORDS|v1|lucky|hard|auto");
  });

  it("names any other language after the size, and round-trips it", () => {
    expect(words.format({ token: "lucky", version: 1, difficulty: "hard", lang: "en" })).toBe("WORDS:lucky:1:hard:en");
    expect(words.format({ token: "lucky", version: 1, difficulty: "hard", size: 7, lang: "en" })).toBe("WORDS:lucky:1:hard:7:en");
    expect(words.parse("WORDS:lucky:1:hard:en")).toEqual({ token: "lucky", version: 1, difficulty: "hard", lang: "en" });
    expect(words.parse("WORDS:lucky:1:hard:7:EN")).toEqual({ token: "lucky", version: 1, difficulty: "hard", size: 7, lang: "en" });
    expect(words.parse("WORDS:lucky:1:hard:7:pt-br")).toEqual({ token: "lucky", version: 1, difficulty: "hard", size: 7 });
    expect(words.languageOf({ token: "x", version: 1, difficulty: "easy", lang: "en" })).toBe("en");
    // Another language is another puzzle: the PRNG key differs.
    expect(words.rngKey({ token: "lucky", version: 1, difficulty: "hard", lang: "en" })).toBe("WORDS|v1|lucky|hard|auto|en");
  });

  it("refuses a language it does not have, and any language on a game without them", () => {
    expect(words.parse("WORDS:lucky:1:hard:fr")).toBeNull();
    expect(words.parse("WORDS:lucky:1:hard:en:7")).toBeNull();
    expect(words.parse("WORDS:lucky:1:hard:7:en:extra")).toBeNull();
    expect(plain.parse("PLAIN:lucky:1:hard:en")).toBeNull();
    expect(plain.format({ token: "lucky", version: 1, difficulty: "hard", lang: "en" })).toBe("PLAIN:lucky:1:hard");
    expect(plain.languageOf({ token: "lucky", version: 1, difficulty: "hard" })).toBeUndefined();
  });

  it("gives a loose seed the language asked for, and lets a canonical seed keep its own", () => {
    expect(words.resolve({ seed: "lucky", difficulty: "easy", lang: "en" })).toEqual({ token: "lucky", version: 1, difficulty: "easy", lang: "en" });
    expect(words.resolve({ seed: "lucky", difficulty: "easy", lang: "pt-br" })).toEqual({ token: "lucky", version: 1, difficulty: "easy" });
    expect(words.resolve({ seed: "lucky", lang: "fr" })).toEqual({ token: "lucky", version: 1, difficulty: "medium" });
    expect(words.resolve({ seed: "WORDS:lucky:1:hard", lang: "en" })).toEqual({ token: "lucky", version: 1, difficulty: "hard" });
    expect(plain.resolve({ seed: "lucky", lang: "en" })).toEqual({ token: "lucky", version: 1, difficulty: "medium" });
  });

  it("has one daily puzzle per language, with the same number and tier", () => {
    const config = { epoch: "2026-11-22", schedule: { 0: ["medium"], 1: ["medium"], 2: ["medium"], 3: ["medium"], 4: ["medium"], 5: ["medium"], 6: ["medium"] }, generatorVersion: 1 } as const;
    const portuguese = getDailyInfo(words, config, "2026-11-25", "pt-br");
    const english = getDailyInfo(words, config, "2026-11-25", "en");
    expect(portuguese).toMatchObject({ number: 4, seed: "WORDS:2026-11-25:1:medium" });
    expect(portuguese.variant).toBeUndefined();
    expect(english).toMatchObject({ number: 4, seed: "WORDS:2026-11-25:1:medium:en", variant: "en" });
    expect(getDailyInfo(words, config, "2026-11-25")).toEqual(portuguese);
  });
});

describe("the game language", () => {
  it("follows the interface until the player picks one", () => {
    expect(effectiveGameLanguage(null, "en")).toBe("en");
    expect(effectiveGameLanguage(undefined, "pt-br")).toBe("pt-br");
    expect(effectiveGameLanguage("pt-br", "en")).toBe("pt-br");
  });

  it("gives only the games made of words a daily per language", () => {
    expect(dailyVariant(GAMES.termo, "en")).toBe("en");
    expect(dailyVariant(GAMES.wend, "pt-br")).toBeUndefined();
    expect(dailyVariant(GAMES.chess, "en")).toBeUndefined();
    expect(dailyVariant(GAMES.zip, "en")).toBeUndefined();
  });
});

describe("daily results per language", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetIdbConnection();
  });

  const result = { game: "termo", number: 4, difficulty: "medium", elapsedMs: 30_000, hintsUsed: 0, mistakes: 2, moves: 3, revealed: false } as const;

  it("stores the day's puzzle of each language apart, and counts one streak", async () => {
    await saveDailyResult({ ...result, date: "2026-11-24", seed: "TERMO:2026-11-24:1:medium" });
    await saveDailyResult({ ...result, date: "2026-11-25", seed: "TERMO:2026-11-25:1:medium:en", variant: "en", elapsedMs: 12_000 });
    expect(await loadDailyResult("termo", "2026-11-25")).toBeUndefined();
    expect((await loadDailyResult("termo", "2026-11-25", "en"))?.elapsedMs).toBe(12_000);
    expect((await loadDailyResult("termo", "2026-11-24"))?.elapsedMs).toBe(30_000);

    // The same day solved in both languages is still one day.
    await saveDailyResult({ ...result, date: "2026-11-25", seed: "TERMO:2026-11-25:1:medium" });
    const dates = streakDates(await loadDailyResults("termo"));
    expect(dates.sort()).toEqual(["2026-11-24", "2026-11-25"]);
    expect(computeStreak(dates, "2026-11-25").current).toBe(2);
  });
});

describe("messages", () => {
  /** Names of the values a message takes: "{count, plural, ...}" and "{game}" give ["count", "game"]. Tags such as <time> count too. */
  const placeholders = (message: string): string[] => {
    const found = new Set<string>();
    let depth = 0;
    for (let index = 0; index < message.length; index++) {
      if (message[index] === "{") {
        if (depth % 2 === 0) {
          const name = /^\s*([A-Za-z0-9_]+)\s*[,}]/.exec(message.slice(index + 1))?.[1];
          if (name) found.add(name);
        }
        depth++;
      } else if (message[index] === "}") depth--;
    }
    for (const tag of message.matchAll(/<([A-Za-z]+)>/g)) found.add(`<${tag[1]}>`);
    return [...found].sort();
  };
  const leaf = (messages: Record<string, unknown>, key: string): string => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages) as string;

  for (const namespace of NAMESPACES) {
    it(`${namespace}: every locale has the same keys and the same placeholders`, () => {
      const reference = messagesOf(DEFAULT_LOCALE, namespace);
      const keys = messageKeys(reference).sort();
      for (const locale of LOCALES) {
        const messages = messagesOf(locale, namespace);
        expect(messageKeys(messages).sort(), `${locale}/${namespace}.json`).toEqual(keys);
        for (const key of keys) {
          const text = leaf(messages, key);
          expect(text.trim(), `${locale}/${namespace}.json ${key}`).not.toBe("");
          // An em dash in copy is a style error in this project.
          expect(text, `${locale}/${namespace}.json ${key}`).not.toContain("\u2014");
          expect(placeholders(text), `${locale}/${namespace}.json ${key}`).toEqual(placeholders(leaf(reference, key)));
        }
      }
    });
  }
});
