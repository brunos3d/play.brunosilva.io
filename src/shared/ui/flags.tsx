import type { Locale } from "@/i18n/config";
import { LOCALE_META } from "@/i18n/config";

type FlagProps = { className?: string };

const frame = { viewBox: "0 0 28 20", "aria-hidden": true } as const;

/** Simplified on purpose: at 20 pixels wide the stars and the motto would be noise. */
function FlagUS({ className }: FlagProps) {
  return (
    <svg {...frame} className={className}>
      <rect width="28" height="20" fill="#f5f5f5" />
      <path d="M0 1.5h28M0 4.6h28M0 7.7h28M0 10.8h28M0 13.9h28M0 17h28" stroke="#b22234" strokeWidth="1.55" />
      <rect width="12.5" height="10.9" fill="#3c3b6e" />
      <g fill="#f5f5f5">
        {[2.1, 5.4, 8.8].flatMap((y) => [2, 4.8, 7.6, 10.4].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.75" />))}
      </g>
    </svg>
  );
}

function FlagBR({ className }: FlagProps) {
  return (
    <svg {...frame} className={className}>
      <rect width="28" height="20" fill="#229e45" />
      <path d="M14 2.6 25.2 10 14 17.4 2.8 10Z" fill="#f8e509" />
      <circle cx="14" cy="10" r="4.5" fill="#2b49a3" />
      <path d="M9.7 9.1a8.6 8.6 0 0 1 8.7 2.3" fill="none" stroke="#f5f5f5" strokeWidth="0.95" />
    </svg>
  );
}

const FLAGS = { us: FlagUS, br: FlagBR } as const;

/** The flag that stands for a locale in the language switcher. Decorative: the language's name is always next to it or in the label. */
export function LocaleFlag({ locale, className }: FlagProps & { locale: Locale }) {
  const Flag = FLAGS[LOCALE_META[locale].flag];
  return <Flag className={className} />;
}
