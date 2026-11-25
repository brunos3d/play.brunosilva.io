import type { Translate } from "@/i18n/translate";
import type { HintReason, QueensHint, UnitRef } from "./hint";
import type { MoveError } from "./rules";

/**
 * Every sentence the Queens engine has to say, built from the engine's data
 * and a translator for the "queens" namespace (messages/<locale>/queens.json).
 * The rules and the hints return codes, groups and counts only, so the engine
 * speaks whatever language the translator does.
 *
 * A group is never named by gluing words together here. Each message takes the
 * kind of the group (`row`, `column`, `color` for a region the board shows in
 * a colour, `region` for one that only has a number) and phrases the whole
 * clause itself, so a language is free to say "row 3" or "da linha 3".
 */

/**
 * The colour a region has on the board, already translated ("rose", "rosa").
 * The engine does not know colours, so the board passes this. Without it a
 * region is called by its number.
 */
export type RegionColorName = (region: number) => string | undefined;

/** Why a queen was refused. */
export function moveErrorText(t: Translate, error: MoveError): string {
  return t(`error.${error.rule}`);
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "1", "2 and 3", "1, 4 and 5", with the conjunction of the translator's language. */
function list(t: Translate, items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return t("list.and", { head: items.slice(0, -1).join(", "), last: items[items.length - 1] });
}

/** The values a message needs to name one region: by colour when the board has one, by number otherwise. */
function regionValues(region: number, colorOf?: RegionColorName): { region: string; color: string; number: number } {
  const color = colorOf?.(region);
  return { region: color ? "color" : "region", color: color ?? "", number: region + 1 };
}

/** The values a message needs to name one group of any kind. */
function unitValues(unit: UnitRef, colorOf?: RegionColorName): { unit: string; color: string; number: number } {
  const color = unit.kind === "region" ? colorOf?.(unit.index) : undefined;
  return { unit: color ? "color" : unit.kind, color: color ?? "", number: unit.index + 1 };
}

function reasonText(t: Translate, reason: HintReason, colorOf?: RegionColorName): string {
  switch (reason.code) {
    case "single":
    case "trial":
      return t(`hint.step.${reason.code}`, unitValues(reason.unit, colorOf));
    case "blocker":
      return t("hint.step.blocker", { ...unitValues(reason.unit, colorOf), cells: reason.cells });
    case "confined-region":
    case "confined-line":
      return t(`hint.step.${reason.code}`, { ...regionValues(reason.region, colorOf), line: reason.line.kind, lineNumber: reason.line.index + 1 });
    case "region-group":
    case "line-group": {
      // Each region is one item of the list, phrased by the language ("the rose region", or just "rosa" after "as regiões").
      const regions = list(t, reason.regions.map((region) => t("hint.regionInList", regionValues(region, colorOf))));
      const lines = list(t, reason.lines.map((line) => String(line.index + 1)));
      return capitalize(t(`hint.step.${reason.code}`, { regions, line: reason.lines[0].kind, lines }));
    }
    case "solution":
      return t("hint.solution", regionValues(reason.region, colorOf));
  }
}

/** What a hint did and why. */
export function hintText(t: Translate, hint: QueensHint, colorOf?: RegionColorName): string {
  if (hint.kind === "wrong-queen") return t("hint.wrongQueen");
  if (hint.kind === "wrong-mark") return t("hint.wrongMark");
  if (hint.kind === "complete") return t("hint.complete");
  return reasonText(t, hint.reason, colorOf);
}
