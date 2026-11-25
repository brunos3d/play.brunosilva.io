import type { Translate } from "@/i18n/translate";
import type { SumbreakHint } from "./hint";
import type { MergeError } from "./rules";

/**
 * Every sentence the Sumbreak engine has to say, built from the engine's data
 * and a translator for the "sumbreak" namespace
 * (messages/<locale>/sumbreak.json). The rules and the hints return codes and
 * numbers only, so the engine speaks whatever language the translator does.
 *
 * A number on a tile goes into a message as text. Given as a number, the
 * translator would group its digits ("1,024"), and a tile shows "1024".
 */
export const tileText = (value: number): string => String(value);

/** Why a merge was refused. */
export function mergeErrorText(t: Translate, error: MergeError): string {
  return t(`error.${error.code}`, error.values && Object.fromEntries(Object.entries(error.values).map(([name, value]) => [name, tileText(value)])));
}

/** What a hint did and why. Empty for a board with nothing left to do. */
export function hintText(t: Translate, hint: SumbreakHint): string {
  if (hint.kind === "complete") return "";
  if (hint.kind === "dead-end") return t(`hint.deadEnd.${hint.reason}`, { smallest: tileText(hint.smallest), count: hint.count });
  // How safe the merge is: the only pair, the only way out of several, or one of several.
  const why = hint.total === 1 ? "onlyPair" : hint.alive === 1 ? "onlySafe" : "oneOfSafe";
  return t("hint.merge", { value: tileText(hint.value), row: hint.row, column: hint.column, direction: hint.direction, why, total: hint.total, alive: hint.alive });
}
