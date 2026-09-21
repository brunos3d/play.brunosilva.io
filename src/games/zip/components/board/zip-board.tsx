"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useId, useMemo, useRef } from "react";
import type { Topology } from "../../engine/grid";
import { nextNumber } from "../../engine/rules";
import type { ZipShape } from "../../engine/types";

type BoardProps = {
  puzzle: ZipShape;
  topology: Topology;
  path: readonly number[];
  /** Colour per path position. */
  colors: readonly string[];
  locked: boolean;
  solved: boolean;
  shakeSignal: number;
  /** The cell whose step was just refused. */
  refusedCell: number | null;
  /** Cells a hint is about to cut off. */
  wrongCells: readonly number[];
  /** Cells left uncovered when the path reached the last number too early. */
  missingCells: readonly number[];
  /** Development only: the stored solution, drawn as a thin line. */
  debugSolution?: readonly number[] | null;
  label: string;
  onPress: (cell: number) => void;
  onDrag: (cell: number) => void;
  onRelease: () => void;
  /** Arrow keys: move the head one cell. Backspace passes "back". */
  onKeyStep: (direction: "up" | "down" | "left" | "right" | "back") => void;
};

const SHAKE_MS = 300;

export function ZipBoard({ puzzle, topology, path, colors, locked, solved, shakeSignal, refusedCell, wrongCells, missingCells, debugSolution, label, onPress, onDrag, onRelease, onKeyStep }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Source of truth for the handlers. React batches pointermove updates, so state would lag behind fast input.
  const draggingRef = useRef(false);
  const lastCellRef = useRef(-1);
  // The grid's box, measured once per drag. Reading it on every pointermove forces a layout pass
  // each time, which was a measured cost on phones in the canvas version of this game. The board
  // cannot move during a drag: touch-action is none and the status line has a fixed height.
  const dragBoxRef = useRef<DOMRect | null>(null);
  const { width, height } = puzzle;
  // Gradient ids must be unique per board: the tutorial board and the game board can be on screen together.
  const gradientId = `zip-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const orderOf = useMemo(() => new Map(path.map((cell, index) => [cell, index])), [path]);
  const wrong = useMemo(() => new Set(wrongCells), [wrongCells]);
  const missing = useMemo(() => new Set(missingCells), [missingCells]);
  const head = path.length > 0 ? path[path.length - 1] : -1;
  const expected = nextNumber(topology, path);
  // A hidden number shows "?" until the path covers it. Then it shows the place it takes on this path,
  // which is its real number only if the path is right, so nothing is given away.
  const placeOf = useMemo(() => {
    const places = new Map<number, number>();
    let count = 0;
    for (const cell of path) if (topology.numberAt[cell] !== 0) places.set(cell, ++count);
    return places;
  }, [path, topology]);
  const center = (cell: number) => ({ x: (cell % width) + 0.5, y: Math.floor(cell / width) + 0.5 });

  useEffect(() => {
    if (shakeSignal === 0) return;
    const board = boardRef.current;
    if (!board) return;
    board.dataset.shake = "false";
    void board.offsetWidth; // restart the animation when two refusals come back to back
    board.dataset.shake = "true";
    const timeout = window.setTimeout(() => {
      board.dataset.shake = "false";
    }, SHAKE_MS);
    return () => window.clearTimeout(timeout);
  }, [shakeSignal]);

  const cellFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const box = dragBoxRef.current ?? gridRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return null;
      const column = Math.floor(((clientX - box.left) / box.width) * width);
      const row = Math.floor(((clientY - box.top) / box.height) * height);
      if (column < 0 || row < 0 || column >= width || row >= height) return null;
      return row * width + column;
    },
    [height, width],
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
    const keys: Record<string, "up" | "down" | "left" | "right" | "back"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Backspace: "back", Delete: "back" };
    const direction = keys[event.key];
    if (!direction) return;
    event.preventDefault();
    onKeyStep(direction);
  };

  return (
    <div
      ref={boardRef}
      className="mg-board zip-board"
      style={{ "--cols": width, "--rows": height } as CSSProperties}
      data-locked={locked}
      data-solved={solved}
      data-testid="zip-board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={gridRef} className="mg-grid" role="grid" tabIndex={0} aria-label={label} aria-rowcount={height} aria-colcount={width} onKeyDown={handleKeyDown}>
        {Array.from({ length: height }, (_, row) => (
          <div key={row} role="row" style={{ display: "contents" }}>
            {Array.from({ length: width }, (_, column) => {
              const cell = row * width + column;
              const order = orderOf.get(cell);
              const number = topology.numberAt[cell];
              const parts = [`Row ${row + 1}, column ${column + 1}.`];
              if (number) parts.push(topology.hiddenAt[cell] ? (placeOf.has(cell) ? `Hidden number, number ${placeOf.get(cell)} on this path.` : "Hidden number.") : `Number ${number}.`);
              parts.push(order === undefined ? "Empty." : cell === head ? `End of the path, step ${order + 1}.` : `On the path, step ${order + 1}.`);
              return (
                <div
                  key={cell}
                  role="gridcell"
                  className="mg-cell zip-cell"
                  aria-label={parts.join(" ")}
                  aria-rowindex={row + 1}
                  aria-colindex={column + 1}
                  data-visited={order !== undefined ? "true" : undefined}
                  data-refused={cell === refusedCell ? "true" : undefined}
                  data-wrong={wrong.has(cell) ? "true" : undefined}
                  data-missing={missing.has(cell) ? "true" : undefined}
                  style={order !== undefined ? ({ "--patch": colors[order], "--order": order } as CSSProperties) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mg-layer" aria-hidden="true">
        <svg className="zip-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {debugSolution && <polyline points={debugSolution.map((cell) => `${center(cell).x},${center(cell).y}`).join(" ")} fill="none" stroke="#d6249f" strokeWidth={0.05} strokeDasharray="0.12 0.1" />}

          {/*
            The colour runs continuously along the path. Each segment blends from its first cell's
            colour to its second one's, and a disc in the exact vertex colour closes every joint.
            Flat-coloured segments with round caps left a darker blob wherever two of them overlapped.
          */}
          <defs>
            {path.slice(1).map((cell, index) => {
              const from = center(path[index]);
              const to = center(cell);
              return (
                <linearGradient key={`${path[index]}-${cell}`} id={`${gradientId}-${index}`} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
                  <stop offset="0" className="zip-stop" style={{ "--seg": colors[index] } as CSSProperties} />
                  <stop offset="1" className="zip-stop" style={{ "--seg": colors[index + 1] } as CSSProperties} />
                </linearGradient>
              );
            })}
          </defs>
          {path.slice(1).map((cell, index) => {
            const from = center(path[index]);
            const to = center(cell);
            return <line key={`${path[index]}-${cell}`} className="zip-segment" data-testid="zip-segment" x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={`url(#${gradientId}-${index})`} />;
          })}
          {path.map((cell, index) => (
            <circle key={cell} className="zip-joint" cx={center(cell).x} cy={center(cell).y} r={0.15} style={{ "--seg": colors[index] } as CSSProperties} />
          ))}

          {puzzle.walls.map((wall) => {
            const row = Math.floor(wall.a / width);
            const column = wall.a % width;
            const sideways = wall.b === wall.a + 1;
            const inset = 0.1;
            return sideways ? (
              <line key={`${wall.a}-${wall.b}`} className="zip-wall" data-testid="zip-wall" x1={column + 1} y1={row + inset} x2={column + 1} y2={row + 1 - inset} />
            ) : (
              <line key={`${wall.a}-${wall.b}`} className="zip-wall" data-testid="zip-wall" x1={column + inset} y1={row + 1} x2={column + 1 - inset} y2={row + 1} />
            );
          })}

          {head >= 0 && topology.numberAt[head] === 0 && !solved && <circle className="zip-head" cx={center(head).x} cy={center(head).y} r={0.17} style={{ "--seg": colors[path.length - 1] } as CSSProperties} />}

          {puzzle.checkpoints.map((checkpoint) => {
            const x = checkpoint.column + 0.5;
            const y = checkpoint.row + 0.5;
            const place = placeOf.get(checkpoint.row * width + checkpoint.column);
            const hidden = checkpoint.hidden === true;
            return (
              <g key={checkpoint.number} className="zip-number" data-testid={hidden ? "zip-hidden-number" : undefined}>
                {/* The ring never marks a hidden number: it would say which "?" comes next. */}
                {checkpoint.number === expected && !hidden && !solved && !locked && <circle className="zip-number-ring" cx={x} cy={y} r={0.4} />}
                <circle className="zip-number-disc" data-hidden={hidden || undefined} cx={x} cy={y} r={hidden ? 0.27 : 0.29} />
                <text className="zip-number-text" data-hidden={hidden || undefined} x={x} y={y}>
                  {hidden ? (place ?? "?") : checkpoint.number}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
