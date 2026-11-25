import type { Translate } from "@/i18n/translate";
import { hasShapeRule } from "./clues/clue";
import type { Hint } from "./hints/hint";
import type { Clue } from "./types";
import type { RegionError } from "./validation/validate-region";

/**
 * Every sentence the Patches engine has to say, built from the engine's data
 * and a translator for the "patches" namespace (messages/<locale>/patches.json).
 * The rules and the hints return codes and numbers only, so the engine speaks
 * whatever language the translator does.
 */

/** A clue in plain language, for cell labels and hint text: "a wide rectangle of 6 cells". */
export function clueText(t: Translate, clue: Clue): string {
  const shape = clue.shape ?? "unconstrained";
  if (clue.area !== undefined) return t(hasShapeRule(clue) ? "clue.sized" : "clue.sizedAny", { shape, area: clue.area });
  return t(hasShapeRule(clue) ? "clue.unsized" : "clue.unsizedAny", { shape });
}

/** Why a rectangle was refused. */
export function regionErrorText(t: Translate, error: RegionError): string {
  return t(`error.${error.code}`, error.values);
}

/** What a hint did and why. */
export function hintText(t: Translate, hint: Hint): string {
  if (hint.kind === "complete") return t("hint.complete");
  if (hint.kind === "wrong-region") return t(`hint.${hint.reason}`);

  const values = { clue: clueText(t, hint.clue), width: hint.rect.width, height: hint.rect.height };
  if (hint.technique === "clue-single") return t(hint.neededElimination ? "hint.clueSingleEliminated" : "hint.clueSingle", values);
  if (hint.technique === "cell-single" && hint.focusCell) return t("hint.cellSingle", { ...values, row: hint.focusCell.row + 1, column: hint.focusCell.column + 1 });
  return t("hint.search", values);
}
