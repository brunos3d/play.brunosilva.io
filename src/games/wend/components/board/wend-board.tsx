"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useRef, useState } from "react";
import type { Trail } from "../../engine/game/state";
import type { WendShape } from "../../engine/types";

type BoardProps = {
  shape: WendShape;
  trails: readonly Trail[];
  /** The open trail a tap would extend. */
  active: number | null;
  /** Colour per hidden word, by word index. */
  colors: readonly string[];
  locked: boolean;
  solved: boolean;
  /** The letter a hint has just revealed. */
  hintCell: number | null;
  /** Changes whenever a word is found. The newest found word replays its flourish. */
  foundSignal: number;
  /** Development only: the hidden paths, drawn as thin lines. */
  debugSolution?: boolean;
  label: string;
  testId?: string;
  onPress: (cell: number) => void;
  onDrag: (cell: number) => void;
  onRelease: () => void;
  /** Keyboard: Enter or Space on the cursor cell. */
  onTap: (cell: number) => void;
  /** Keyboard: Backspace. */
  onBack: () => void;
};

const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/**
 * The letter grid. Trails are drawn as thick lines under the letters: an open
 * trail in pencil grey, a found word in its fabric colour. The first letter of
 * every trail carries a ring, so the reading direction is visible.
 */
export function WendBoard({ shape, trails, active, colors, locked, solved, hintCell, foundSignal, debugSolution, label, testId = "wend-board", onPress, onDrag, onRelease, onTap, onBack }: BoardProps) {
  const t = useTranslations("wend.board");
  const gridRef = useRef<HTMLDivElement>(null);
  // Source of truth for the handlers. React batches pointermove updates, so state would lag behind fast input.
  const draggingRef = useRef(false);
  const lastCellRef = useRef(-1);
  // The grid's box, measured once per drag. The board cannot move during one: touch-action is none.
  const dragBoxRef = useRef<DOMRect | null>(null);
  const [cursor, setCursor] = useState(() => shape.letters.findIndex((letter) => letter !== ""));
  const { size, letters } = shape;

  const trailOf = new Map<number, Trail>();
  for (const trail of trails) for (const cell of trail.cells) trailOf.set(cell, trail);
  const center = (cell: number) => ({ x: (cell % size) + 0.5, y: Math.floor(cell / size) + 0.5 });
  const newest = trails.reduce<Trail | null>((latest, trail) => (trail.word !== null && (!latest || trail.id > latest.id) ? trail : latest), null);

  const cellFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const box = dragBoxRef.current ?? gridRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return null;
      const column = Math.floor(((clientX - box.left) / box.width) * size);
      const row = Math.floor(((clientY - box.top) / box.height) * size);
      if (column < 0 || row < 0 || column >= size || row >= size) return null;
      return row * size + column;
    },
    [size],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Measure before locating the press, so a stale box can never decide which cell was hit.
    dragBoxRef.current = gridRef.current?.getBoundingClientRect() ?? null;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience. Without it the drag still works while the pointer stays over the board.
    }
    draggingRef.current = true;
    lastCellRef.current = cell;
    event.currentTarget.dataset.dragging = "true";
    setCursor(cell);
    onPress(cell);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !event.isPrimary) return;
    // Browsers merge fast moves into one event. Every merged point is a cell the finger really crossed.
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const point of coalesced.length > 0 ? coalesced : [event.nativeEvent]) {
      const cell = cellFromPoint(point.clientX, point.clientY);
      if (cell === null || cell === lastCellRef.current) continue;
      lastCellRef.current = cell;
      onDrag(cell);
    }
  };

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !event.isPrimary) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = false;
    dragBoxRef.current = null;
    event.currentTarget.dataset.dragging = "false";
    onRelease();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked || event.metaKey || event.ctrlKey || event.altKey) return;
    const move = MOVES[event.key];
    if (move) {
      event.preventDefault();
      const row = Math.min(size - 1, Math.max(0, Math.floor(cursor / size) + move[0]));
      const column = Math.min(size - 1, Math.max(0, (cursor % size) + move[1]));
      setCursor(row * size + column);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTap(cursor);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      onBack();
    }
  };

  return (
    <div
      className="mg-board wend-board"
      style={{ "--cols": size, "--rows": size } as CSSProperties}
      data-locked={locked}
      data-solved={solved}
      data-testid={testId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={gridRef} className="mg-grid" role="grid" tabIndex={0} aria-label={label} aria-rowcount={size} aria-colcount={size} onKeyDown={handleKeyDown}>
        {Array.from({ length: size }, (_, row) => (
          <div key={row} role="row" style={{ display: "contents" }}>
            {Array.from({ length: size }, (_, column) => {
              const cell = row * size + column;
              const letter = letters[cell];
              const trail = trailOf.get(cell);
              // What a screen reader says for the cell, in the interface language. Only the letter and the word come from the board.
              const parts = [t("cell", { row: row + 1, column: column + 1 })];
              if (letter === "") parts.push(t("wall"));
              else {
                parts.push(t("letter", { letter }));
                if (trail?.word !== null && trail?.word !== undefined) parts.push(t("found", { word: shape.words[trail.word].display }));
                else if (trail) parts.push(t("onTrail", { index: trail.cells.indexOf(cell) + 1, count: trail.cells.length }));
              }
              return (
                <div
                  key={cell}
                  role="gridcell"
                  className="mg-cell wend-cell"
                  aria-label={parts.join(" ")}
                  aria-rowindex={row + 1}
                  aria-colindex={column + 1}
                  aria-current={cell === cursor ? "true" : undefined}
                  data-testid={`wend-cell-${cell}`}
                  data-letter={letter || undefined}
                  data-wall={letter === "" ? "true" : undefined}
                  data-state={trail ? (trail.word !== null ? "found" : "open") : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mg-layer" aria-hidden="true">
        <svg className="wend-svg" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none">
          {trails.map((trail) => {
            const found = trail.word !== null;
            const start = center(trail.cells[0]);
            return (
              <g
                key={found ? `${trail.id}-${trail === newest ? foundSignal : "found"}` : trail.id}
                className="wend-trail"
                data-testid="wend-trail"
                data-found={found || undefined}
                data-active={trail.id === active || undefined}
                data-new={trail === newest || undefined}
                style={found ? ({ "--word": colors[trail.word as number] } as CSSProperties) : undefined}
              >
                <polyline className="wend-line" points={trail.cells.map((cell) => `${center(cell).x},${center(cell).y}`).join(" ")} />
                {/* A one-letter trail has no line to draw, so the disc is what shows it. */}
                <circle className="wend-start" cx={start.x} cy={start.y} r={0.36} />
              </g>
            );
          })}

          {debugSolution &&
            shape.words.map((word) => (
              <polyline key={word.text} points={word.path.map((cell) => `${center(cell).x},${center(cell).y}`).join(" ")} fill="none" stroke="#d6249f" strokeWidth={0.05} strokeDasharray="0.12 0.1" />
            ))}

          {hintCell !== null && <circle className="wend-hint" cx={center(hintCell).x} cy={center(hintCell).y} r={0.4} />}

          {letters.map((letter, cell) => {
            if (letter === "") return null;
            const trail = trailOf.get(cell);
            return (
              <text key={cell} className="wend-letter" data-state={trail ? (trail.word !== null ? "found" : "open") : undefined} x={center(cell).x} y={center(cell).y}>
                {letter}
              </text>
            );
          })}

          <rect className="wend-cursor" x={(cursor % size) + 0.06} y={Math.floor(cursor / size) + 0.06} width={0.88} height={0.88} rx={0.16} />
        </svg>
      </div>
    </div>
  );
}
