import type { Clue, ShapeConstraint } from "../../engine/types";

type BadgeProps = {
  clue: Clue;
  /** Cell count of the placed patch, shown for numberless clues once a patch exists. */
  derivedArea?: number;
};

const FRAME: Record<"square" | "tall" | "wide", { x: number; y: number; width: number; height: number }> = {
  square: { x: 5, y: 5, width: 30, height: 30 },
  tall: { x: 10, y: 2, width: 20, height: 36 },
  wide: { x: 2, y: 10, width: 36, height: 20 },
};

function ShapeOutline({ shape }: { shape: ShapeConstraint | undefined }) {
  if (shape === "square" || shape === "tall" || shape === "wide") {
    return <rect {...FRAME[shape]} rx={5} fill="none" stroke="currentColor" strokeWidth={2.4} />;
  }
  if (shape === "freeform") {
    // Two overlapping dashed rectangles: the patch could be tall, wide or square.
    return (
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3.5 3" opacity={0.75}>
        <rect {...FRAME.tall} rx={5} />
        <rect {...FRAME.wide} rx={5} />
      </g>
    );
  }
  return null;
}

/** The icon outline carries the shape rule and the number sits inside it. Never colour alone. */
export function ClueBadge({ clue, derivedArea }: BadgeProps) {
  const label = clue.area ?? derivedArea;
  return (
    <div className="patches-clue" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <ShapeOutline shape={clue.shape} />
      </svg>
      {label !== undefined ? (
        <span className="patches-clue-number" data-derived={clue.area === undefined}>
          {label}
        </span>
      ) : clue.shape === undefined || clue.shape === "unconstrained" ? (
        <span className="patches-clue-number" data-derived="true">
          ?
        </span>
      ) : null}
    </div>
  );
}
