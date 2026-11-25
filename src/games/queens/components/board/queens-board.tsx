"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { MARK, QUEEN, queensOf } from "../../engine/game/state";
import type { Topology } from "../../engine/grid";
import { ruledOutCells } from "../../engine/rules";
import type { QueensShape } from "../../engine/types";
import { Cross, Crown } from "./crown";
import type { RegionColor } from "./palette";

type BoardProps = {
  puzzle: QueensShape;
  topology: Topology;
  /** One value per cell: empty, X or queen. */
  marks: readonly number[];
  /** Colour per region id. */
  colors: readonly RegionColor[];
  locked: boolean;
  solved: boolean;
  shakeSignal: number;
  /** The cell whose queen was just refused, and the queen that refused it. */
  refused: { cell: number; with: number } | null;
  /** Cells a hint is about to clear. */
  wrongCells: readonly number[];
  /** Cells of the group a hint is talking about. */
  hintCells: readonly number[];
  /** Cells a hint is acting on. */
  hintTargets: readonly number[];
  /** Development only: the stored solution, drawn as rings. */
  debugSolution?: readonly number[] | null;
  label: string;
  onPress: (cell: number) => void;
  onDrag: (cell: number) => void;
  onRelease: () => void;
  /** Enter or Space on the keyboard cursor. */
  onKeyCycle: (cell: number) => void;
  /** Delete or Backspace on the keyboard cursor. */
  onKeyClear: (cell: number) => void;
};

const SHAKE_MS = 300;

export function QueensBoard({ puzzle, topology, marks, colors, locked, solved, shakeSignal, refused, wrongCells, hintCells, hintTargets, debugSolution, label, onPress, onDrag, onRelease, onKeyCycle, onKeyClear }: BoardProps) {
  const t = useTranslations("queens");
  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Source of truth for the handlers. React batches pointermove updates, so state would lag behind fast input.
  const draggingRef = useRef(false);
  const lastCellRef = useRef(-1);
  // The grid's box, measured once per drag, so pointermove never forces a layout pass.
  const dragBoxRef = useRef<DOMRect | null>(null);
  const [cursor, setCursor] = useState(0);
  const { size, regions } = puzzle;
  // Cell ids must be unique per board: the tutorial board and the game board can be on screen together.
  const idBase = `queens-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const ruledOut = useMemo(() => ruledOutCells(topology, queensOf(marks)), [marks, topology]);
  const wrong = useMemo(() => new Set(wrongCells), [wrongCells]);
  const hinted = useMemo(() => new Set(hintCells), [hintCells]);
  const targets = useMemo(() => new Set(hintTargets), [hintTargets]);
  const colorNames = useMemo(() => colors.map((color) => t(`color.${color.name}`)), [colors, t]);

  // Edges between two regions, as one SVG path. Cell edges inside a region are left to the tiles.
  const borders = useMemo(() => {
    let path = "";
    for (let cell = 0; cell < regions.length; cell++) {
      const row = Math.floor(cell / size);
      const column = cell % size;
      if (column < size - 1 && regions[cell + 1] !== regions[cell]) path += `M${column + 1} ${row}v1`;
      if (row < size - 1 && regions[cell + size] !== regions[cell]) path += `M${column} ${row + 1}h1`;
    }
    return path;
  }, [regions, size]);

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
      event.currentTarget.dataset.dragging = "true";
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
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const row = Math.floor(cursor / size);
    const column = cursor % size;
    const moves: Record<string, number> = {
      ArrowUp: row > 0 ? cursor - size : cursor,
      ArrowDown: row < size - 1 ? cursor + size : cursor,
      ArrowLeft: column > 0 ? cursor - 1 : cursor,
      ArrowRight: column < size - 1 ? cursor + 1 : cursor,
      Home: row * size,
      End: row * size + size - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setCursor(moves[event.key]);
      return;
    }
    if (locked) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onKeyCycle(cursor);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onKeyClear(cursor);
    }
  };

  return (
    <div
      ref={boardRef}
      className="mg-board queens-board"
      style={{ "--cols": size, "--rows": size } as CSSProperties}
      data-locked={locked}
      data-solved={solved}
      data-testid="queens-board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={gridRef} className="mg-grid" role="grid" tabIndex={0} aria-label={label} aria-rowcount={size} aria-colcount={size} aria-activedescendant={`${idBase}-${cursor}`} onKeyDown={handleKeyDown}>
        {Array.from({ length: size }, (_, row) => (
          <div key={row} role="row" style={{ display: "contents" }}>
            {Array.from({ length: size }, (_, column) => {
              const cell = row * size + column;
              const region = regions[cell];
              const mark = marks[cell];
              const auto = mark !== QUEEN && ruledOut.has(cell);
              const same = (other: number) => regions[other] === region;
              // A tile joins its neighbours of the same region, so a region reads as one piece of fabric.
              const up = row > 0 && same(cell - size);
              const right = column < size - 1 && same(cell + 1);
              const down = row < size - 1 && same(cell + size);
              const left = column > 0 && same(cell - 1);
              const state = t(mark === QUEEN ? "board.queen" : mark === MARK ? "board.marked" : auto ? "board.ruledOut" : "board.empty");
              return (
                <div
                  key={cell}
                  id={`${idBase}-${cell}`}
                  role="gridcell"
                  className="mg-cell queens-cell"
                  aria-label={`${t("board.cell", { row: row + 1, column: column + 1, color: colorNames[region] })} ${state}`}
                  aria-rowindex={row + 1}
                  aria-colindex={column + 1}
                  aria-selected={cell === cursor}
                  data-region={region}
                  data-mark={mark === QUEEN ? "queen" : mark === MARK ? "x" : undefined}
                  data-auto={auto && mark !== MARK ? "true" : undefined}
                  data-cursor={cell === cursor ? "true" : undefined}
                  data-refused={refused?.cell === cell ? "true" : undefined}
                  data-conflict={refused?.with === cell ? "true" : undefined}
                  data-wrong={wrong.has(cell) ? "true" : undefined}
                  data-hint={hinted.has(cell) ? "true" : undefined}
                  data-target={targets.has(cell) ? "true" : undefined}
                  style={
                    {
                      "--patch": colors[region].value,
                      "--order": row,
                      "--gt": up ? 0 : 1,
                      "--gr": right ? 0 : 1,
                      "--gb": down ? 0 : 1,
                      "--gl": left ? 0 : 1,
                      "--rtl": up || left ? 0 : 1,
                      "--rtr": up || right ? 0 : 1,
                      "--rbr": down || right ? 0 : 1,
                      "--rbl": down || left ? 0 : 1,
                    } as CSSProperties
                  }
                >
                  {mark === QUEEN && <Crown className="queens-crown" />}
                  {mark === MARK && <Cross className="queens-x" />}
                  {auto && mark !== MARK && <span className="queens-dot" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mg-layer" aria-hidden="true">
        <svg className="queens-svg" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none">
          <path className="queens-border" d={borders} data-testid="queens-borders" />
          {debugSolution?.map((cell) => <circle key={cell} cx={(cell % size) + 0.5} cy={Math.floor(cell / size) + 0.5} r={0.38} fill="none" stroke="#d6249f" strokeWidth={0.05} strokeDasharray="0.12 0.1" />)}
        </svg>
      </div>
    </div>
  );
}
