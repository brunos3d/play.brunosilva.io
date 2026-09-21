import type { CSSProperties } from "react";

const SIZE = 6;

/** Placeholder board shown while a puzzle is generated, so the layout does not jump. */
export function LoadingBoard() {
  return (
    <div className="mg-board" style={{ "--cols": SIZE, "--rows": SIZE } as CSSProperties} role="status" aria-label="Building the puzzle">
      <div className="mg-grid">
        {Array.from({ length: SIZE * SIZE }, (_, index) => (
          <div key={index} className="mg-cell mg-loading-cell" style={{ "--delay": `${((index % SIZE) + Math.floor(index / SIZE)) * 70}ms` } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}
