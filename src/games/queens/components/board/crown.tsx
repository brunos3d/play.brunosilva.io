/** The queen: a hand-drawn crown, the same one the game's icon wears. Ink colour is fixed because region tiles are pastel in both themes. */
export function Crown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.6 16.6h14.8l1.7-9.2-4.7 3.7L12 4.6 7.6 11.1 2.9 7.4z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5.4 19.8h13.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** The player's X: "no queen here". */
export function Cross({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
