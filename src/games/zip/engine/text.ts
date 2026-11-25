import type { Translate } from "@/i18n/translate";
import type { ZipHint } from "./hint";
import type { MoveError } from "./rules";

/**
 * Every sentence the Zip engine has to say, built from the engine's data and
 * a translator for the "zip" namespace (messages/<locale>/zip.json). The rules
 * and the hints return codes and numbers only, so the engine speaks whatever
 * language the translator does.
 */

/** Why a step was refused. */
export function moveErrorText(t: Translate, error: MoveError): string {
  // With hidden numbers on the board, naming the number to reach first would give one away. The sentence talks about positions instead.
  const key = error.code === "wrong-number" && error.hidden ? "wrong-number-hidden" : error.code;
  return t(`error.${key}`, error.values);
}

/** What a hint did and why. Empty for a board with nothing left to do. */
export function hintText(t: Translate, hint: ZipHint): string {
  if (hint.kind === "extend") return t("hint.extend", { target: hint.target });
  if (hint.kind === "complete") return "";
  if (hint.keep === 0) return t("hint.startOnOne");
  return hint.lastGood ? t("hint.wrongAfterNumber", { number: hint.lastGood }) : t("hint.wrongAfterCells", { count: hint.keep });
}
