/**
 * Vibration feedback. Optional everywhere: iOS Safari has no Vibration API,
 * and desktop browsers ignore it. Every call is safe to make unconditionally.
 */

export type HapticPattern = "place" | "remove" | "invalid" | "hint" | "complete" | "step" | "checkpoint";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  place: 10,
  remove: 6,
  invalid: [18, 40, 18],
  hint: 12,
  complete: [14, 50, 14, 50, 30],
  step: 4,
  checkpoint: 12,
};

export function supportsHaptics(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function vibrate(pattern: HapticPattern, enabled: boolean): void {
  if (!enabled || !supportsHaptics()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Some browsers throw when the page has not received a user gesture yet.
  }
}
