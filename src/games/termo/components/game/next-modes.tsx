"use client";

import { useTranslations } from "next-intl";
import { GAMES } from "@/games/registry";
import { Link } from "@/i18n/navigation";
import type { DateKey } from "@/shared/engine/pacific-time";
import { buildPlayPath } from "@/shared/platform/share-text";
import { ArrowRightIcon } from "@/shared/ui/icons";
import { type TermoDailyVariant, termoDailyVariantSpec } from "../../engine/daily";
import { termoSeeds } from "../../engine/seed";
import type { TermoLanguage } from "../../engine/words";

const GAME = GAMES.termo;

export type TermoDayMode = "termo" | TermoDailyVariant;

/** `key` names the label in the messages, under `next`. */
type Step = { key: TermoDayMode | "practice"; href: string };

/**
 * Where a finished puzzle of the day can lead: the day's other modes, then
 * practice. The Dueto and the Quarteto are the ones of the language just
 * played. The daily Termo has one address for every language, and shows the
 * player's game language.
 */
export function termoNextSteps(date: DateKey, current: TermoDayMode, language: TermoLanguage): Step[] {
  const steps: Step[] = [];
  if (current !== "termo") steps.push({ key: "termo", href: GAME.path });
  if (current !== "dueto") steps.push({ key: "dueto", href: buildPlayPath(GAME.path, termoSeeds, termoDailyVariantSpec(date, "dueto", language)) });
  if (current !== "quarteto") steps.push({ key: "quarteto", href: buildPlayPath(GAME.path, termoSeeds, termoDailyVariantSpec(date, "quarteto", language)) });
  steps.push({ key: "practice", href: `${GAME.path}/practice` });
  return steps;
}

/**
 * Shown twice once a puzzle of the day is over: on the result screen, and under
 * the board where the keyboard was. The daily is always one board, and this is
 * how a player gets to two or four. `testId` tells the two copies apart.
 */
export function TermoNextModes({ date, current, language, testId = "termo-next" }: { date: DateKey; current: TermoDayMode; language: TermoLanguage; testId?: string }) {
  const t = useTranslations("termo.next");
  return (
    <nav className="termo-next" aria-label={t("label")} data-testid={testId}>
      {termoNextSteps(date, current, language).map((step) => (
        <Link key={step.key} href={step.href} prefetch={false} className="mg-button justify-between" data-testid={`${testId}-${step.key}`}>
          {t(step.key)} <ArrowRightIcon />
        </Link>
      ))}
    </nav>
  );
}
