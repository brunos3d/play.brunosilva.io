import type { GameId } from "@/games/registry";

type Props = { className?: string; title?: string };

const frame = { viewBox: "0 0 64 64", xmlns: "http://www.w3.org/2000/svg" } as const;

/**
 * Game marks. They use fixed fabric colours, not theme tokens, so the same
 * artwork works as an in-page icon, a favicon and a PWA icon. public/icons/
 * holds the same drawings as files. Keep the two in sync.
 */
export function ZipIcon({ className, title }: Props) {
  return (
    <svg {...frame} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="15" fill="#f6f1e7" />
      <g fill="#e9e0cf">
        {[0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => <rect key={`${row}-${column}`} x={9 + column * 16} y={9 + row * 16} width="14" height="14" rx="3.5" />))}
      </g>
      <path d="M16 16h32v16H16v16h32" fill="none" stroke="#c2553d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="6.5" fill="#2a2622" />
      <circle cx="48" cy="48" r="6.5" fill="#2a2622" />
      <path d="M15 13.2 17 12v8" fill="none" stroke="#f6f1e7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M45.4 45.6a2.6 2.6 0 1 1 4.4 1.9l-4.4 4.3h5.4" fill="none" stroke="#f6f1e7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PatchesIcon({ className, title }: Props) {
  return (
    <svg {...frame} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="15" fill="#f6f1e7" />
      <rect x="9" y="9" width="27" height="27" rx="5" fill="#f2b5b0" />
      <rect x="39" y="9" width="16" height="46" rx="5" fill="#a8d3ea" />
      <rect x="9" y="39" width="27" height="16" rx="5" fill="#f3dc8f" />
      <g fill="none" stroke="#2a2622" strokeOpacity=".3" strokeWidth="1.4" strokeDasharray="3 2.6">
        <rect x="12" y="12" width="21" height="21" rx="3" />
        <rect x="42" y="12" width="10" height="40" rx="3" />
        <rect x="12" y="42" width="21" height="10" rx="3" />
      </g>
    </svg>
  );
}

const KNIGHT_BODY = "M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21";
const KNIGHT_HEAD = "M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3";

/** A knight on four squares. The knight is the Cburnett piece, used under its BSD licence (see docs/chess/CHESS.md). */
export function ChessIcon({ className, title }: Props) {
  return (
    <svg {...frame} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="15" fill="#f6f1e7" />
      <rect x="9" y="9" width="22" height="22" rx="5" fill="#e9e0cf" />
      <rect x="33" y="9" width="22" height="22" rx="5" fill="#a9c58d" />
      <rect x="9" y="33" width="22" height="22" rx="5" fill="#a9c58d" />
      <rect x="33" y="33" width="22" height="22" rx="5" fill="#e9e0cf" />
      <g transform="translate(5 3.5) scale(1.2)" fill="#2a2622" stroke="#2a2622" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={KNIGHT_BODY} />
        <path d={KNIGHT_HEAD} />
        <circle cx="9" cy="25.5" r="0.6" fill="#f6f1e7" stroke="#f6f1e7" strokeWidth="1" />
        <path d="M14.2 14.2l1.4 2.2" fill="none" stroke="#f6f1e7" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

const CROWN = "M-5 4.2h10l1.3-7.4-3.6 3L0-5.2l-2.7 5-3.6-3z";

/** Coloured regions with two crowns that do not touch. */
export function QueensIcon({ className, title }: Props) {
  return (
    <svg {...frame} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="15" fill="#f6f1e7" />
      <rect x="9" y="9" width="14" height="14" rx="3.5" fill="#f2b5b0" />
      <rect x="25" y="9" width="14" height="14" rx="3.5" fill="#f2b5b0" />
      <rect x="41" y="9" width="14" height="14" rx="3.5" fill="#a8d3ea" />
      <rect x="9" y="25" width="14" height="14" rx="3.5" fill="#f3dc8f" />
      <rect x="25" y="25" width="14" height="14" rx="3.5" fill="#f2b5b0" />
      <rect x="41" y="25" width="14" height="14" rx="3.5" fill="#a8d3ea" />
      <rect x="9" y="41" width="14" height="14" rx="3.5" fill="#f3dc8f" />
      <rect x="25" y="41" width="14" height="14" rx="3.5" fill="#bfd8a8" />
      <rect x="41" y="41" width="14" height="14" rx="3.5" fill="#bfd8a8" />
      <g fill="#2a2622" stroke="#2a2622" strokeWidth="1.2" strokeLinejoin="round">
        <path d={CROWN} transform="translate(16 16.4)" />
        <path d={CROWN} transform="translate(48 32.4)" />
      </g>
    </svg>
  );
}

/** Two equal tiles about to merge, above the tile they make. */
export function SumbreakIcon({ className, title }: Props) {
  return (
    <svg {...frame} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="15" fill="#f6f1e7" />
      <rect x="9" y="9" width="22" height="22" rx="5.5" fill="#a8d3ea" />
      <rect x="33" y="9" width="22" height="22" rx="5.5" fill="#a8d3ea" />
      <rect x="9" y="33" width="22" height="22" rx="5.5" fill="none" stroke="#2a2622" strokeOpacity=".3" strokeWidth="1.5" strokeDasharray="3 2.6" />
      <rect x="33" y="33" width="22" height="22" rx="5.5" fill="#c2553d" />
      <g fill="none" stroke="#2a2622" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.2 17.2a2.9 2.9 0 1 1 5 2.1l-5 4.9h6" />
        <path d="M41.2 17.2a2.9 2.9 0 1 1 5 2.1l-5 4.9h6" />
      </g>
      <path d="M46.5 38v12M40.5 46l5.5-8h.500M40.5 46h9.5" fill="none" stroke="#f6f1e7" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Platform mark: four tiles, one per kind of fabric. */
export function PlatformIcon({ className, title }: Props) {
  return (
    <svg {...frame} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="15" fill="#f6f1e7" />
      <rect x="10" y="10" width="20" height="20" rx="5.5" fill="#c2553d" />
      <rect x="34" y="10" width="20" height="20" rx="5.5" fill="#a8d3ea" />
      <rect x="10" y="34" width="20" height="20" rx="5.5" fill="#f3dc8f" />
      <rect x="34" y="34" width="20" height="20" rx="5.5" fill="#bfd8a8" />
    </svg>
  );
}

export function GameIcon({ game, ...props }: Props & { game: GameId }) {
  const Icon = { zip: ZipIcon, patches: PatchesIcon, chess: ChessIcon, queens: QueensIcon, sumbreak: SumbreakIcon }[game];
  return <Icon {...props} />;
}
