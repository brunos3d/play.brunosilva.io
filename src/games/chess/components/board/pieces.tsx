import type { ReactNode } from "react";

/**
 * The chess pieces, drawn by Colin M.L. Burnett ("Cburnett") and published on
 * Wikimedia Commons under several licences, of which this project uses the
 * 3-clause BSD one. The notice is in docs/chess/CHESS.md. These are the pieces
 * Wikipedia and Lichess show, so most players already read them at a glance.
 *
 * Every piece is drawn in a 45 by 45 box. Colours are fixed: the board keeps
 * its green and cream squares in both themes, and the pieces go with them.
 */
const LIGHT = "#fff";
const DARK = "#000";

const outline = { fill: "none", fillRule: "evenodd", stroke: DARK, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const PAWN_PATH = "m22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34C34 31.58 29.59 27.09 26.59 26.03 28.06 24.84 29 23.03 29 21 29 18.59 27.67 16.5 25.72 15.38 26.21 14.71 26.5 13.89 26.5 13c0-2.21-1.79-4-4-4z";
const KNIGHT_BODY = "M22 10C32.5 11 38.5 18 38 39L15 39C15 30 25 32.5 23 18";
const KNIGHT_HEAD = "M24 18C24.38 20.91 18.45 25.37 16 27C13 29 13.18 31.34 11 31C9.958 30.06 12.41 27.96 11 28C10 28 11.19 29.23 10 30C9 30 5.997 31 6 26C6 24 12 14 12 14C12 14 13.89 12.1 14 10.5C13.27 9.506 13.5 8.5 13.5 7.5C14.5 6.5 16.5 10 16.5 10L18.5 10C18.5 10 19.28 8.008 21 7C22 7 22 10 22 10";
const KNIGHT_EYE = "M9.5 25.5A.5.5 0 1 1 8.5 25.5A.5.5 0 1 1 9.5 25.5z";
const KNIGHT_NOSTRIL = "M15 15.5A.5 1.5 0 1 1 14 15.5A.5 1.5 0 1 1 15 15.5z";
const KNIGHT_MANE = "M24.55 10.4L24.1 11.85L24.6 12C27.75 13 30.25 14.49 32.5 18.75C34.75 23.01 35.75 29.06 35.25 39L35.2 39.5L37.45 39.5L37.5 39C38 28.94 36.62 22.15 34.25 17.66C31.88 13.17 28.46 11.02 25.06 10.5L24.55 10.4z";
const BISHOP_BASE = "M9 36C12.39 35.03 19.11 36.43 22.5 34C25.89 36.43 32.61 35.03 36 36C36 36 37.65 36.54 39 38C38.32 38.97 37.35 38.99 36 38.5C32.61 37.53 25.89 38.96 22.5 37.5C19.11 38.96 12.39 37.53 9 38.5C7.65 38.99 6.68 38.97 6 38C7.35 36.54 9 36 9 36z";
const BISHOP_BODY = "M15 32C17.5 34.5 27.5 34.5 30 32C30.5 30.5 30 30 30 30C30 27.5 27.5 26 27.5 26C33 24.5 33.5 14.5 22.5 10.5C11.5 14.5 12 24.5 17.5 26C17.5 26 15 27.5 15 30C15 30 14.5 30.5 15 32z";
const BISHOP_TOP = "M25 8A2.5 2.5 0 1 1 20 8A2.5 2.5 0 1 1 25 8z";
const BISHOP_LINES = "M17.5 26L27.5 26M15 30L30 30M22.5 15.5L22.5 20.5M20 18L25 18";
const QUEEN_CROWN = "M9 26C17.5 24.5 30 24.5 36 26L38.5 13.5L31 25L30.7 10.9L25.5 24.5L22.5 10L19.5 24.5L14.3 10.9L14 25L6.5 13.5L9 26z";
const QUEEN_BODY = "M9 26C9 28 10.5 28 11.5 30C12.5 31.5 12.5 31 12 33.5C10.5 34.5 11 36 11 36C9.5 37.5 11 38.5 11 38.5C17.5 39.5 27.5 39.5 34 38.5C34 38.5 35.5 37.5 34 36C34 36 34.5 34.5 33 33.5C32.5 31 32.5 31.5 33.5 30C34.5 28 36 28 36 26C27.5 24.5 17.5 24.5 9 26z";
const QUEEN_DOTS: readonly (readonly [number, number])[] = [[6, 12], [14, 9], [22.5, 8], [31, 9], [39, 12]];
const KING_HEAD = "M22.5 25C22.5 25 27 17.5 25.5 14.5C25.5 14.5 24.5 12 22.5 12C20.5 12 19.5 14.5 19.5 14.5C18 17.5 22.5 25 22.5 25";

function Pawn({ fill }: { fill: string }) {
  return <path d={PAWN_PATH} fill={fill} stroke={DARK} strokeWidth={1.5} strokeLinecap="round" />;
}

function Knight({ fill, detail }: { fill: string; detail: string }) {
  return (
    <g {...outline} transform="translate(0 .3)">
      <path d={KNIGHT_BODY} fill={fill} />
      <path d={KNIGHT_HEAD} fill={fill} />
      <path d={KNIGHT_EYE} fill={detail} stroke={detail} />
      <path d={KNIGHT_NOSTRIL} transform="matrix(.866 .5 -.5 .866 9.693 -5.173)" fill={detail} stroke={detail} />
      {fill === DARK && <path d={KNIGHT_MANE} fill={detail} stroke="none" />}
    </g>
  );
}

function Bishop({ fill, detail }: { fill: string; detail: string }) {
  return (
    <g {...outline} transform="translate(0 .6)">
      <g fill={fill} strokeLinecap="butt">
        <path d={BISHOP_BASE} />
        <path d={BISHOP_BODY} />
        <path d={BISHOP_TOP} />
      </g>
      <path d={BISHOP_LINES} stroke={detail} strokeLinejoin="miter" />
    </g>
  );
}

function Rook({ fill }: { fill: string }) {
  if (fill === DARK) {
    return (
      <g {...outline} fill={DARK} transform="translate(0 .3)">
        <path d="M9 39L36 39L36 36L9 36L9 39z" strokeLinecap="butt" />
        <path d="M12.5 32L14 29.5L31 29.5L32.5 32L12.5 32z" strokeLinecap="butt" />
        <path d="M12 36L12 32L33 32L33 36L12 36z" strokeLinecap="butt" />
        <path d="M14 29.5L14 16.5L31 16.5L31 29.5L14 29.5z" strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M14 16.5L11 14L34 14L31 16.5L14 16.5z" strokeLinecap="butt" />
        <path d="M11 14L11 9L15 9L15 11L20 11L20 9L25 9L25 11L30 11L30 9L34 9L34 14L11 14z" strokeLinecap="butt" />
        <path d="M12 35.5L33 35.5M13 31.5L32 31.5M14 29.5L31 29.5M14 16.5L31 16.5M11 14L34 14" fill="none" stroke={LIGHT} strokeWidth={1} strokeLinejoin="miter" />
      </g>
    );
  }
  return (
    <g {...outline} fill={LIGHT} transform="translate(0 .3)">
      <path d="M9 39L36 39L36 36L9 36L9 39z" strokeLinecap="butt" />
      <path d="M12 36L12 32L33 32L33 36L12 36z" strokeLinecap="butt" />
      <path d="M11 14L11 9L15 9L15 11L20 11L20 9L25 9L25 11L30 11L30 9L34 9L34 14" strokeLinecap="butt" />
      <path d="M34 14L31 17L14 17L11 14" />
      <path d="M31 17L31 29.5L14 29.5L14 17" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M31 29.5L32.5 32L12.5 32L14 29.5" />
      <path d="M11 14L34 14" fill="none" strokeLinejoin="miter" />
    </g>
  );
}

function Queen({ fill }: { fill: string }) {
  const dots = QUEEN_DOTS.map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r={2} />);
  if (fill === DARK) {
    return (
      <g fill={DARK} stroke={DARK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={QUEEN_CROWN} strokeLinecap="butt" />
        <path d="m9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
        <path d="M11.5 30C15 29 30 29 33.5 30" />
        <path d="m12 33.5c6-1 15-1 21 0" />
        {dots}
        <path d="M11 38.5A35 35 1 0 0 34 38.5" fill="none" strokeLinecap="butt" />
        <g fill="none" stroke={LIGHT}>
          <path d="M11 29A35 35 1 0 1 34 29" />
          <path d="M12.5 31.5L32.5 31.5" />
          <path d="M11.5 34.5A35 35 1 0 0 33.5 34.5" />
          <path d="M10.5 37.5A35 35 1 0 0 34.5 37.5" />
        </g>
      </g>
    );
  }
  return (
    <g fill={LIGHT} stroke={DARK} strokeWidth={1.5} strokeLinejoin="round">
      <path d={QUEEN_CROWN} />
      <path d={QUEEN_BODY} />
      <path d="M11.5 30C15 29 30 29 33.5 30" fill="none" />
      <path d="M12 33.5C18 32.5 27 32.5 33 33.5" fill="none" />
      {dots}
    </g>
  );
}

function King({ fill }: { fill: string }) {
  if (fill === DARK) {
    return (
      <g {...outline}>
        <path d="M22.5 11.63L22.5 6" strokeLinejoin="miter" />
        <path d={KING_HEAD} fill={DARK} strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M12.5 37C18 40.5 27 40.5 32.5 37L32.5 30C32.5 30 41.5 25.5 38.5 19.5C34.5 13 25 16 22.5 23.5L22.5 27L22.5 23.5C20 16 10.5 13 6.5 19.5C3.5 25.5 12.5 30 12.5 30L12.5 37" fill={DARK} />
        <path d="M20 8L25 8" strokeLinejoin="miter" />
        <path d="M32 29.5C32 29.5 40.5 25.5 38.03 19.85C34.15 14 25 18 22.5 24.5L22.5 26.6L22.5 24.5C20 18 10.85 14 6.97 19.85C4.5 25.5 13 29.5 13 29.5" stroke={LIGHT} />
        <path d="M12.5 30C18 27 27 27 32.5 30M12.5 33.5C18 30.5 27 30.5 32.5 33.5M12.5 37C18 34 27 34 32.5 37" stroke={LIGHT} />
      </g>
    );
  }
  return (
    <g {...outline}>
      <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" />
      <path d={KING_HEAD} fill={LIGHT} strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7" fill={LIGHT} />
      <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" />
    </g>
  );
}

/** One piece as an SVG. `type` is the engine's piece type (1 pawn to 6 king), `color` 0 for White and 1 for Black. */
export function ChessPiece({ type, color, className }: { type: number; color: number; className?: string }) {
  const fill = color === 0 ? LIGHT : DARK;
  const detail = color === 0 ? DARK : LIGHT;
  const art: Record<number, ReactNode> = {
    1: <Pawn fill={fill} />,
    2: <Knight fill={fill} detail={detail} />,
    3: <Bishop fill={fill} detail={detail} />,
    4: <Rook fill={fill} />,
    5: <Queen fill={fill} />,
    6: <King fill={fill} />,
  };
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true" focusable="false">
      {art[type]}
    </svg>
  );
}
