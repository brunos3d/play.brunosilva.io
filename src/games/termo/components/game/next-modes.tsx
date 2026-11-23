import Link from "next/link";
import { GAMES } from "@/games/registry";
import type { DateKey } from "@/shared/engine/pacific-time";
import { buildPlayPath } from "@/shared/platform/share-text";
import { ArrowRightIcon } from "@/shared/ui/icons";
import { type TermoDailyVariant, termoDailyVariantSpec } from "../../engine/daily";
import { termoSeeds } from "../../engine/seed";

const GAME = GAMES.termo;

export type TermoDayMode = "termo" | TermoDailyVariant;

type Step = { key: string; label: string; href: string };

/** Where a finished puzzle of the day can lead: the day's other modes, then practice. */
export function termoNextSteps(date: DateKey, current: TermoDayMode): Step[] {
  const steps: Step[] = [];
  if (current !== "termo") steps.push({ key: "termo", label: "Play the daily Termo", href: GAME.path });
  if (current !== "dueto") steps.push({ key: "dueto", label: "Play the daily Dueto", href: buildPlayPath(GAME.path, termoSeeds, termoDailyVariantSpec(date, "dueto")) });
  if (current !== "quarteto") steps.push({ key: "quarteto", label: "Play the daily Quarteto", href: buildPlayPath(GAME.path, termoSeeds, termoDailyVariantSpec(date, "quarteto")) });
  steps.push({ key: "practice", label: "Practice", href: `${GAME.path}/practice` });
  return steps;
}

/**
 * Shown twice once a puzzle of the day is over: on the result screen, and under
 * the board where the keyboard was. The daily is always one board, and this is
 * how a player gets to two or four. `testId` tells the two copies apart.
 */
export function TermoNextModes({ date, current, testId = "termo-next" }: { date: DateKey; current: TermoDayMode; testId?: string }) {
  return (
    <nav className="termo-next" aria-label="More Termo" data-testid={testId}>
      {termoNextSteps(date, current).map((step) => (
        <Link key={step.key} href={step.href} prefetch={false} className="mg-button justify-between" data-testid={`${testId}-${step.key}`}>
          {step.label} <ArrowRightIcon />
        </Link>
      ))}
    </nav>
  );
}
