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
  return game === "zip" ? <ZipIcon {...props} /> : <PatchesIcon {...props} />;
}
