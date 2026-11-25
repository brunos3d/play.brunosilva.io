import type { CoachMood } from "../../engine/coach";

/**
 * Sofia, the coach: an owl in the platform's fabric colours. Her eyes and brows
 * change with what she is saying, so the mood reads before the text does.
 * `label` names her in the game language, the one she speaks.
 */
export function CoachAvatar({ mood, label, className }: { mood: CoachMood; label: string; className?: string }) {
  const ink = "#2a2622";
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={label} data-mood={mood}>
      <circle cx="32" cy="32" r="31" fill="#f3dc8f" />
      <path d="M17 19 15 7l11 6M47 19l2-12-11 6" fill="#c2553d" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M32 11c-11.5 0-18 7.5-18 19v9c0 10.5 7.5 17 18 17s18-6.5 18-17v-9c0-11.5-6.5-19-18-19Z" fill="#c2553d" stroke={ink} strokeWidth="1.6" />
      <path d="M32 37c-6 0-10 4-10 9.5 0 5 4 8.5 10 8.5s10-3.5 10-8.5C42 41 38 37 32 37Z" fill="#f6f1e7" />
      <path d="m27.5 44 2 2 2-2m1 0 2 2 2-2M30 49.5l2 2 2-2" fill="none" stroke="#c2553d" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.5" cy="27" r="8" fill="#fffdf8" stroke={ink} strokeWidth="1.6" />
      <circle cx="40.5" cy="27" r="8" fill="#fffdf8" stroke={ink} strokeWidth="1.6" />
      {mood === "happy" ? (
        <path d="M19.5 28c1.5-3 6.5-3 8 0M36.5 28c1.5-3 6.5-3 8 0" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <>
          <circle cx={mood === "thinking" ? 25.5 : 23.5} cy={mood === "worried" ? 29 : mood === "thinking" ? 24.5 : 27} r="3.3" fill={ink} />
          <circle cx={mood === "thinking" ? 42.5 : 40.5} cy={mood === "worried" ? 29 : mood === "thinking" ? 24.5 : 27} r="3.3" fill={ink} />
        </>
      )}
      {mood === "worried" && <path d="M16.5 19.5 27 22.5M47.5 19.5 37 22.5" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />}
      {mood === "thinking" && <path d="M17 20.5h9M37 17.5l9 1.5" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />}
      <path d="M32 30.5 28.5 35.5h7Z" fill="#f3b63f" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
