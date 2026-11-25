import type { GameLanguage } from "@/i18n/game-language";
import type { Coach } from "./coach";
import { COACH_EN } from "./en";
import { COACH_PT_BR } from "./pt-br";

export type { Coach, CoachMessage, CoachMood, CoachText, MoveForm } from "./coach";
export { type MoveFacts, moveFacts } from "./facts";

/** A new game language needs a coach here before it compiles. */
const COACHES: Record<GameLanguage, Coach> = { en: COACH_EN, "pt-br": COACH_PT_BR };

/** The coach who speaks a game language. It follows the game language setting, never the interface locale. */
export function coachFor(language: GameLanguage): Coach {
  return COACHES[language];
}
